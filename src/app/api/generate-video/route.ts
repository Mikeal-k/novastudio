import { NextRequest } from "next/server";
import { submitVideoGeneration, getGenerationCost } from "@/lib/seedance";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { optimizeImagePrompt } from "@/lib/prompt-optimizer";
import { SocksProxyAgent } from "socks-proxy-agent";
import https from "https";
import fs from "fs";
import path from "path";

/**
 * Map frontend aspect ratio to OpenAI image size.
 */
function mapAspectRatioToSize(ratio: string): string {
  const sizeMap: Record<string, string> = {
    "1:1": "1024x1024",
    "9:16": "1024x1536",
    "16:9": "1536x1024",
  };
  return sizeMap[ratio] ?? "1024x1024";
}

/**
 * Dedicated function for OpenAI Images API (gpt-image-1.5) generation.
 * Uses https.request directly (matching the proven test-image15-16x9.cjs pattern)
 * to avoid "socket hang up" errors that occur with generic fetch wrappers.
 */
interface OpenAIImageRequestBody {
  model: string;
  prompt: string;
  size: string;
  quality: string;
  output_format: string;
  output_compression?: number;
  n: number;
  /**
   * NOTE: response_format is intentionally omitted here.
   *
   * Verified via scripts/test-openai-image-url-mode.cjs:
   *   GPT Image 2 returns HTTP 400 "Unknown parameter: 'response_format'"
   *   when response_format: "url" is passed. This model ONLY supports
   *   b64_json output — there is no supported "small response" mode.
   *
   * All generation requests use b64_json, and truncation safeguards
   * (compression retry, content-length integrity check) are in place.
   */
}

interface OpenAIImageResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

async function postOpenAIImageGeneration(
  body: OpenAIImageRequestBody
): Promise<OpenAIImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const proxyUrl = process.env.OPENAI_PROXY_URL;

  const bodyStr = JSON.stringify(body);

  // Use a stable generation id for tracing in logs
  const genId = crypto.randomUUID().slice(0, 8);
  const overallTimeoutMs = 300_000; // 5 minutes for GPT Image 2

  console.log(
    `[generate-video] [${genId}] OpenAI image request started: model=${body.model} size=${body.size} quality=${body.quality} output_format=${body.output_format} compression=${body.output_compression} proxy=${proxyUrl ? "enabled" : "disabled"} timeout=${overallTimeoutMs}ms`
  );

  return new Promise<OpenAIImageResult>((resolve, reject) => {
    // ── settled flag: ensure resolve/reject only called once ──────────
    let settled = false;

    function settle<T>(fn: (value: T | PromiseLike<T>) => void, val: T) {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimeout);
      fn(val);
    }

    // ── Overall timeout ──────────────────────────────────────────────
    const overallTimeout = setTimeout(() => {
      console.log(`[generate-video] [${genId}] timeout fired: ${overallTimeoutMs}ms exceeded`);
      req.destroy(new Error(`OpenAI 请求超时（${overallTimeoutMs / 1000} 秒）`));
    }, overallTimeoutMs);

    const options: https.RequestOptions = {
      method: "POST",
      hostname: "api.openai.com",
      path: "/v1/images/generations",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: overallTimeoutMs,
    };

    if (proxyUrl) {
      options.agent = new SocksProxyAgent(proxyUrl);
    }

    const req = https.request(options, (res) => {
      const contentLength = res.headers["content-length"]
        ? parseInt(res.headers["content-length"], 10)
        : null;

      console.log(
        `[generate-video] [${genId}] response statusCode=${res.statusCode} content-type=${res.headers["content-type"] ?? "N/A"} content-length=${contentLength ?? "N/A"}`
      );

      let data = "";
      res.on("data", (chunk: string) => {
        data += chunk;
      });

      // Handle response stream abort (proxy disconnect mid-stream, etc.)
      res.on("aborted", () => {
        const actualBytes = Buffer.byteLength(data, "utf8");
        console.log(`[generate-video] [${genId}] res aborted. data so far: ${data.length} chars (${actualBytes} bytes)`);
        if (data.length > 0) {
          // Partial data received before abort → this is truncation
          settle(
            reject,
            new Error(
              `OpenAI 图片结果返回过程中被截断（传输中断），已接收 ${actualBytes} 字节但响应不完整。请检查代理稳定性。`
            )
          );
        } else {
          settle(
            reject,
            new Error("OpenAI 请求中断，请检查代理或重试")
          );
        }
      });

      res.on("error", (streamErr: Error) => {
        const code = (streamErr as { code?: string }).code;
        console.log(`[generate-video] [${genId}] res error: code=${code ?? "N/A"} message=${streamErr.message}`);
        settle(
          reject,
          new Error(
            /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|ECONNRESET|EPIPE/i.test(
              code ?? streamErr.message
            )
              ? "OpenAI 请求中断，请检查代理或重试"
              : streamErr.message
          )
        );
      });

      res.on("end", () => {
        const actualBytes = Buffer.byteLength(data, "utf8");
        console.log(
          `[generate-video] [${genId}] response end: rawLength=${data.length} actualBytes=${actualBytes} contentLength=${contentLength ?? "N/A"}`
        );

        // ── Integrity check 1: content-length vs actual bytes ──────────
        if (contentLength !== null && actualBytes < contentLength) {
          console.log(
            `[generate-video] [${genId}] TRUNCATED: content-length=${contentLength}, actual=${actualBytes}, missing=${contentLength - actualBytes} bytes`
          );
          settle(
            reject,
            new Error(
              `OpenAI 图片结果返回过程中被截断：Content-Length 为 ${contentLength} 字节，实际仅收到 ${actualBytes} 字节，缺失 ${contentLength - actualBytes} 字节。请检查代理稳定性。`
            )
          );
          return;
        }

        // ── Try JSON parse ───────────────────────────────────────────
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          const snippet = data.length > 200 ? data.slice(0, 200) + "..." : data;
          console.log(
            `[generate-video] [${genId}] JSON parse failed. data.length=${data.length} actualBytes=${actualBytes} contentLength=${contentLength}`
          );
          console.log(`[generate-video] [${genId}] First 200 chars: ${snippet}`);
          settle(
            reject,
            new Error(
              `OpenAI 返回的 JSON 数据解析失败（${actualBytes} 字节）—— 响应可能被截断或不完整。请检查代理稳定性。响应前 200 字符: ${snippet}`
            )
          );
          return;
        }

        console.log(
          `[generate-video] [${genId}] response body size: ${actualBytes} bytes, data keys: ${Object.keys(parsed).join(", ")}`
        );

        settle(resolve, {
          ok: res.statusCode === 200,
          status: res.statusCode ?? 500,
          body: parsed,
        });
      });
    });

    req.on("timeout", () => {
      console.log(`[generate-video] [${genId}] req timeout fired`);
      settle(
        reject,
        new Error("OpenAI 请求超时，请检查代理或重试")
      );
      req.destroy();
    });

    req.on("error", (err: Error) => {
      const code = (err as { code?: string }).code;
      console.log(`[generate-video] [${genId}] req error: code=${code ?? "N/A"} message=${err.message}`);
      // If already settled (e.g., timeout fired destroy), do nothing
      settle(
        reject,
        new Error(
          /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|ECONNRESET/i.test(
            code ?? err.message
          )
            ? "连接 OpenAI 失败，请检查代理或网络"
            : err.message
        )
      );
    });

    req.write(bodyStr);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  // Track if a generation record was created — used by outer catch to mark failed
  let createdGenerationId: string | null = null;

  try {
    // ── Auth check ──────────────────────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { success: false, error: "未提供认证令牌" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const adminClient = createAdminSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { success: false, error: "认证失败，请重新登录" },
        { status: 401 }
      );
    }

    // ── Parse request body ──────────────────────────────────────────────
    const body = await request.json();
    const { prompt, aspectRatio, duration, quality, style, model: bodyModel, audioSfx, audioMusic, referenceImageDataUrl } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return Response.json(
        { success: false, error: "Prompt is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const modelId = bodyModel || "seedance-2";

    // ── Validate referenceImageDataUrl (only for Seedance 2.0) ──────────
    const hasReferenceImage = modelId === "seedance-2" && typeof referenceImageDataUrl === "string" && referenceImageDataUrl.length > 0;
    if (hasReferenceImage) {
      // Must be a data URL
      if (!referenceImageDataUrl.startsWith("data:image/")) {
        return Response.json(
          { success: false, error: "参考图格式无效，请上传 PNG/JPG/WebP 图片" },
          { status: 400 }
        );
      }
      if (!referenceImageDataUrl.includes(";base64,")) {
        return Response.json(
          { success: false, error: "参考图格式无效，请上传 PNG/JPG/WebP 图片" },
          { status: 400 }
        );
      }
      // Limit to 8MB
      if (referenceImageDataUrl.length > 8 * 1024 * 1024) {
        return Response.json(
          { success: false, error: "参考图文件过大，请使用 8MB 以内的图片" },
          { status: 400 }
        );
      }
      console.log(`[generate-video] referenceImage=true referenceImageLength=${referenceImageDataUrl.length}`);
    }

    // ────────────────────────────────────────────────────────────────────
    // GPT Image 1.5 / GPT Image 2 → OpenAI 图片生成
    // ────────────────────────────────────────────────────────────────────
    if (modelId === "gpt-image-1.5" || modelId === "gpt-image-2") {
      const displayName = modelId === "gpt-image-2" ? "GPT Image 2" : "GPT Image 1.5";

      const calculatedCost = getGenerationCost({
        modelId,
        outputType: "image",
      });

      // ── Check credits ────────────────────────────────────────────────
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return Response.json(
          { success: false, error: "获取用户资料失败" },
          { status: 500 }
        );
      }

      if (profile.credits < calculatedCost) {
        return Response.json(
          {
            success: false,
            error: `当前积分不足，本次需要 ${calculatedCost} 积分。请先购买积分后再生成。`,
          },
          { status: 403 }
        );
      }

      // ── Create generation record (status: running) ───────────────────
      const { data: generation, error: genError } = await adminClient
        .from("generations")
        .insert({
          user_id: user.id,
          model: displayName,
          prompt: prompt.trim(),
          output_type: "image",
          status: "running",
          cost: calculatedCost,
          settings: {
            aspectRatio: aspectRatio ?? "1:1",
          },
        })
        .select("id")
        .single();

      if (genError || !generation) {
        console.error("[generate-video] Failed to create generation record:", genError);
        return Response.json(
          { success: false, error: "创建生成记录失败" },
          { status: 500 }
        );
      }

      // Track for outer catch so it can mark failed if unexpected error occurs
      createdGenerationId = generation.id;

      console.log(
        `[generate-video] [${displayName}] generation_id=${generation.id} prompt_length=${prompt.trim().length} model=${modelId} starting OpenAI request`
      );

      // ── Call OpenAI images API ───────────────────────────────────────
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        await adminClient
          .from("generations")
          .update({ status: "failed", error: "未配置 OPENAI_API_KEY" })
          .eq("id", generation.id);

        return Response.json(
          { success: false, error: "未配置 OPENAI_API_KEY" },
          { status: 500 }
        );
      }

      const size = mapAspectRatioToSize(aspectRatio ?? "1:1");

      // ── Optimize prompt for stability (GPT Image only) ────────────────
      const optimizedResult = optimizeImagePrompt(prompt, modelId);
      const optimizedPrompt = optimizedResult.optimized;
      console.log(
        `[generate-video] prompt optimize: enabled=${optimizedResult.enabled} rawLength=${optimizedResult.rawLength} optimizedLength=${optimizedResult.optimizedLength} model=${modelId}`
      );

      // ── Attempt 1: compression=80 ──────────────────────────────────
      let openaiResult: OpenAIImageResult;
      let usedCompression = 80;
      try {
        openaiResult = await postOpenAIImageGeneration({
          model: modelId,
          prompt: optimizedPrompt,
          size,
          quality: "low",
          output_format: "webp",
          output_compression: usedCompression,
          n: 1,
        });
      } catch (fetchError) {
        const errorMsg =
          fetchError instanceof Error ? fetchError.message : "OpenAI 请求失败";
        console.error("[generate-video] OpenAI fetch error (attempt 1):", errorMsg);

        // ── Retry 1: compression=95 (smaller b64 payload) ────────────
        if (
          errorMsg.includes("截断") ||
          errorMsg.includes("传输中断") ||
          errorMsg.includes("解析失败")
        ) {
          console.log("[generate-video] Response truncated, retrying with higher compression (95)...");
          try {
            openaiResult = await postOpenAIImageGeneration({
              model: modelId,
              prompt: optimizedPrompt,
              size,
              quality: "low",
              output_format: "webp",
              output_compression: 95,
              n: 1,
            });
            usedCompression = 95;
            // Retry succeeded; fall through to process result
            console.log("[generate-video] Retry with compression=95 succeeded");
          } catch (retryError) {
            const retryMsg =
              retryError instanceof Error ? retryError.message : "OpenAI 请求失败";
            console.error("[generate-video] Retry also failed:", retryMsg);

            // ── Retry 2: try with lower size (minimal) ──────────────
            if (
              retryMsg.includes("截断") ||
              retryMsg.includes("传输中断") ||
              retryMsg.includes("解析失败")
            ) {
              console.log("[generate-video] Retry still truncated, trying minimal size (1024x1024)...");
              const minimalSize = "1024x1024";
              try {
                openaiResult = await postOpenAIImageGeneration({
                  model: modelId,
                  prompt: optimizedPrompt,
                  size: minimalSize,
                  quality: "low",
                  output_format: "webp",
                  output_compression: 95,
                  n: 1,
                });
                usedCompression = 95;
                console.log("[generate-video] Minimal retry succeeded");
              } catch (minRetryErr) {
                const minRetryMsg =
                  minRetryErr instanceof Error ? minRetryErr.message : "OpenAI 请求失败";
                console.error("[generate-video] Minimal retry also failed:", minRetryMsg);
                await adminClient
                  .from("generations")
                  .update({ status: "failed", error: minRetryMsg })
                  .eq("id", generation.id);
                return Response.json(
                  { success: false, error: minRetryMsg },
                  { status: 500 }
                );
              }
            } else {
              await adminClient
                .from("generations")
                .update({ status: "failed", error: retryMsg })
                .eq("id", generation.id);
              return Response.json(
                { success: false, error: retryMsg },
                { status: 500 }
              );
            }
          }
        } else {
          await adminClient
            .from("generations")
            .update({ status: "failed", error: errorMsg })
            .eq("id", generation.id);
          return Response.json(
            { success: false, error: errorMsg },
            { status: 500 }
          );
        }
      }
const responseBodySize = JSON.stringify(openaiResult.body).length;
console.log(
  `[generate-video] OpenAI request succeeded for generation_id=${generation.id} status=${openaiResult.status} hasData=${openaiResult.body?.data ? "yes" : "no"}`
);
console.log(
  `[generate-video] generation_id=${generation.id} requestMode=b64_json openaiStatusCode=${openaiResult.status} responseBodySize=${responseBodySize} bytes`
);


      if (!openaiResult.ok) {
        let errorMsg = "OpenAI 图片生成失败";
        const serverError = openaiResult.body?.error as
          | { message?: string }
          | undefined;
        if (serverError?.message) {
          errorMsg = serverError.message;
        }

        console.error(
          `[generate-video] OpenAI API error (${openaiResult.status}): ${errorMsg}`
        );

        // Categorize errors for user-friendly messages
        if (openaiResult.status === 401) {
          errorMsg = "OpenAI API Key 无效";
        } else if (openaiResult.status === 403) {
          errorMsg = "当前图片模型权限不足，请检查 OpenAI 账号权限";
        } else if (
          openaiResult.status === 429 ||
          errorMsg.toLowerCase().includes("quota") ||
          errorMsg.toLowerCase().includes("insufficient") ||
          errorMsg.toLowerCase().includes("rate limit") ||
          errorMsg.toLowerCase().includes("exceeded")
        ) {
          errorMsg = "OpenAI 额度不足，请稍后重试";
        }

        await adminClient
          .from("generations")
          .update({ status: "failed", error: errorMsg })
          .eq("id", generation.id);

        return Response.json(
          { success: false, error: errorMsg },
          { status: openaiResult.status }
        );
      }

      const openaiData = openaiResult.body as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };

      const imageData = openaiData.data?.[0];

      // ── Handle b64_json: save to local file ──────────────────────────
      if (imageData?.b64_json) {
        const dataKeys = Object.keys(imageData).join(", ");
        console.log(
          `[generate-video] OpenAI returned b64_json, length: ${imageData.b64_json.length}`
        );
        console.log(
          `[generate-video] generation_id=${generation.id} requestMode=b64_json finalDataKeys=[${dataKeys}] responseBodySize=${responseBodySize} bytes`
        );

        const fileName = `generation-${generation.id}.webp`;
        const relativeDir = "generated/openai";
        const publicDir = path.join(process.cwd(), "public", relativeDir);
        const filePath = path.join(publicDir, fileName);
        const shortUrl = `/${relativeDir}/${fileName}`;

        console.log(`[generate-video] Saving image to: ${filePath}`);
        console.log(`[generate-video] Short URL: ${shortUrl}`);

        // ── Save image file ──────────────────────────────────────────
        try {
          fs.mkdirSync(publicDir, { recursive: true });
          const imageBuffer = Buffer.from(imageData.b64_json, "base64");
          fs.writeFileSync(filePath, imageBuffer);
          console.log(`[generate-video] Image saved successfully: path=${filePath} size=${imageBuffer.length} bytes`);
        } catch (saveError) {
          const errorMsg = "图片保存失败，请重试";
          console.error(`[generate-video] Failed to save image file:`, saveError);

          await adminClient
            .from("generations")
            .update({ status: "failed", error: errorMsg })
            .eq("id", generation.id);

          return Response.json(
            { success: false, error: errorMsg },
            { status: 500 }
          );
        }

        // ── Update generation record as succeeded ──────────────────
        const { error: updateError } = await adminClient
          .from("generations")
          .update({
            status: "succeeded",
            video_url: shortUrl,
            cover_url: shortUrl,
          })
          .eq("id", generation.id);

        if (updateError) {
          console.error(
            "[generate-video] Failed to update generation record:",
            updateError
          );

          // Clean up saved file since DB update failed
          try {
            fs.unlinkSync(filePath);
          } catch {
            // Ignore cleanup errors
          }

          await adminClient
            .from("generations")
            .update({ status: "failed", error: "更新生成记录失败" })
            .eq("id", generation.id);

          return Response.json(
            { success: false, error: "更新生成记录失败" },
            { status: 500 }
          );
        }

        // ── Deduct credits (only after file save + DB update succeed) ─
        console.log(`[generate-video] Deducting ${calculatedCost} credits`);
        const { data: currentProfile } = await adminClient
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        if (currentProfile) {
          const newBalance = currentProfile.credits - calculatedCost;

          await adminClient
            .from("profiles")
            .update({ credits: newBalance, updated_at: new Date().toISOString() })
            .eq("id", user.id);

          // Record transaction
          await adminClient.from("credit_transactions").insert({
            user_id: user.id,
            type: "generation_debit",
            amount: -calculatedCost,
            balance_after: newBalance,
            generation_id: generation.id,
            description: `${displayName} 图片生成扣费`,
          });

          // Update charged_at after successful deduction
          await adminClient
            .from("generations")
            .update({ charged_at: new Date().toISOString() })
            .eq("id", generation.id);
        }
console.log(`[generate-video] DB update succeeded for generation_id=${generation.id}`);
console.log(`[generate-video] ${displayName} generation succeeded: url=${shortUrl}`);


        return Response.json({
          success: true,
          outputUrl: shortUrl,
          generationId: generation.id,
          provider: "openai",
        });
      }

      // ── Handle url: use directly (no b64_json) ──────────────────────
      if (imageData?.url) {
        console.log(`[generate-video] OpenAI returned url directly: ${imageData.url}`);
        const outputUrl = imageData.url;

        // ── Update generation record as succeeded FIRST ─────────────
        const { error: updateError } = await adminClient
          .from("generations")
          .update({
            status: "succeeded",
            video_url: outputUrl,
            cover_url: outputUrl,
          })
          .eq("id", generation.id);

        if (updateError) {
          console.error(
            "[generate-video] Failed to update generation record (url branch):",
            updateError
          );

          await adminClient
            .from("generations")
            .update({ status: "failed", error: "更新生成记录失败" })
            .eq("id", generation.id);

          return Response.json(
            { success: false, error: "更新生成记录失败" },
            { status: 500 }
          );
        }

        console.log(`[generate-video] DB updated succeeded for generation_id=${generation.id}`);

        // ── Deduct credits (only after DB update succeeds) ──────────
        const { data: currentProfile } = await adminClient
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        if (currentProfile) {
          const newBalance = currentProfile.credits - calculatedCost;

          await adminClient
            .from("profiles")
            .update({ credits: newBalance, updated_at: new Date().toISOString() })
            .eq("id", user.id);

          await adminClient.from("credit_transactions").insert({
            user_id: user.id,
            type: "generation_debit",
            amount: -calculatedCost,
            balance_after: newBalance,
            generation_id: generation.id,
            description: `${displayName} 图片生成扣费`,
          });

          // Update charged_at after successful deduction
          await adminClient
            .from("generations")
            .update({ charged_at: new Date().toISOString() })
            .eq("id", generation.id);
        }

        console.log(`[generate-video] ${displayName} generation succeeded: ${outputUrl}`);

        return Response.json({
          success: true,
          outputUrl,
          generationId: generation.id,
          provider: "openai",
        });
      }

      // ── No image data returned ──────────────────────────────────────
      const errorMsg = "OpenAI 返回数据异常：未找到图片数据";
      await adminClient
        .from("generations")
        .update({ status: "failed", error: errorMsg })
        .eq("id", generation.id);

      return Response.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // Seedance 2.0 → 视频生成（原逻辑不变）
    // ────────────────────────────────────────────────────────────────────

    // ── Calculate cost server-side (don't trust client) ─────────────────
    const calculatedCost = getGenerationCost({
      modelId: "seedance-2",
      outputType: "video",
      duration: duration ?? 10,
      quality: quality ?? "标准",
    });

    // ── Check credits ───────────────────────────────────────────────────
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return Response.json(
        { success: false, error: "获取用户资料失败" },
        { status: 500 }
      );
    }

    if (profile.credits < calculatedCost) {
      return Response.json(
        {
          success: false,
          error: `真实视频生成成本较高，本次需要 ${calculatedCost} 积分。请先购买积分后再生成。`,
        },
        { status: 403 }
      );
    }

    // ── Determine audio settings ─────────────────────────────────────────
    const useAudioSfx = audioSfx === true;
    const useAudioMusic = audioMusic === true;
    const generateAudio = useAudioSfx || useAudioMusic;

    // Map quality to resolution
    const qualityValue = quality ?? "标准";
    const resolutionValue = qualityValue === "超清" ? "1080p" : "720p";

    // Build settings object for generation record
    const generationSettings: Record<string, unknown> = {
      aspectRatio: aspectRatio ?? "16:9",
      duration: duration ?? 10,
      quality: qualityValue,
      resolution: resolutionValue,
      style: style ?? "真实质感",
    };
    // Record reference image info (not the full data URL)
    if (hasReferenceImage) {
      generationSettings.hasReferenceImage = true;
      generationSettings.referenceImageMode = "data_url";
    }
    if (generateAudio) {
      generationSettings.audioSfx = useAudioSfx;
      generationSettings.audioMusic = useAudioMusic;
      generationSettings.generateAudio = true;
    }

    // ── Create generation record (status: running) ──────────────────────
    const { data: generation, error: genError } = await adminClient
      .from("generations")
      .insert({
        user_id: user.id,
        model: "Seedance 2.0",
        prompt: prompt.trim(),
        output_type: "video",
        status: "running",
        cost: calculatedCost,
        settings: generationSettings,
      })
      .select("id")
      .single();

    if (genError || !generation) {
      console.error("[generate-video] Failed to create generation record:", genError);
      return Response.json(
        { success: false, error: "创建生成记录失败" },
        { status: 500 }
      );
    }

    // Track for outer catch
    createdGenerationId = generation.id;

    // ── Submit to Seedance API ──────────────────────────────────────────
    const result = await submitVideoGeneration({
      prompt: prompt.trim(),
      aspectRatio,
      duration,
      quality: qualityValue,
      generateAudio,
      audioSfx: useAudioSfx,
      audioMusic: useAudioMusic,
      ...(hasReferenceImage ? { referenceImageDataUrl } : {}),
    });

    // ── Update generation record with task_id ───────────────────────────
    const { error: updateError } = await adminClient
      .from("generations")
      .update({ task_id: result.id })
      .eq("id", generation.id);

    if (updateError) {
      console.error("[generate-video] Failed to update task_id:", updateError);
    }

    return Response.json({
      success: true,
      taskId: result.id,
      generationId: generation.id,
      provider: "seedance",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[generate-video] Unhandled error:", message);

    // CRITICAL FIX: If a generation record was already created, update it to failed
    // so the task doesn't remain stuck in "running" forever.
    if (createdGenerationId) {
      try {
        const adminClient = createAdminSupabaseClient();
        await adminClient
          .from("generations")
          .update({
            status: "failed",
            error: `生成异常中断: ${message}`,
          })
          .eq("id", createdGenerationId);

        console.log(
          `[generate-video] Generation ${createdGenerationId} marked as failed due to unhandled error`
        );
      } catch (dbError) {
        console.error(
          "[generate-video] Failed to mark generation as failed in catch block:",
          dbError
        );
      }
    }

    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
