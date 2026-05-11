import { NextRequest } from "next/server";
import { submitVideoGeneration, getGenerationCost } from "@/lib/seedance";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
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

  console.log(
    `[generate-video] OpenAI image request: model=${body.model} size=${body.size} quality=${body.quality} output_format=${body.output_format} compression=${body.output_compression} proxy=${proxyUrl ? "enabled" : "disabled"}`
  );

  return new Promise<OpenAIImageResult>((resolve, reject) => {
    const options: https.RequestOptions = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: 120000,
    };

    if (proxyUrl) {
      options.agent = new SocksProxyAgent(proxyUrl);
    }

    const req = https.request(
      "https://api.openai.com/v1/images/generations",
      options,
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = {};
          }
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode ?? 500,
            body: parsed,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("socket hang up"));
    });

    req.on("error", (err: Error) => {
      const code = (err as { code?: string }).code;
      if (
        /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|ECONNRESET/i.test(
          code ?? err.message
        )
      ) {
        reject(
          new Error(
            "连接 OpenAI 失败，请检查 OPENAI_PROXY_URL 或网络代理"
          )
        );
      } else {
        reject(err);
      }
    });

    req.write(bodyStr);
    req.end();
  });
}

export async function POST(request: NextRequest) {
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
    const { prompt, aspectRatio, duration, quality, style, model: bodyModel } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return Response.json(
        { success: false, error: "Prompt is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const modelId = bodyModel || "seedance-2";

    // ────────────────────────────────────────────────────────────────────
    // GPT Image 1.5 → OpenAI 图片生成
    // ────────────────────────────────────────────────────────────────────
    if (modelId === "gpt-image-1.5" || modelId === "gpt-image-2") {
      const calculatedCost = getGenerationCost({
        modelId: "gpt-image-1.5",
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
          model: "GPT Image 1.5",
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

      // ── Call OpenAI gpt-image-1.5 API ────────────────────────────────
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        // Mark generation as failed
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

      let openaiResult: OpenAIImageResult;
      try {
        openaiResult = await postOpenAIImageGeneration({
          model: "gpt-image-1.5",
          prompt: prompt.trim(),
          size,
          quality: "low",
          output_format: "webp",
          output_compression: 80,
          n: 1,
        });
      } catch (fetchError) {
        const errorMsg =
          fetchError instanceof Error ? fetchError.message : "OpenAI 请求失败";
        console.error("[generate-video] OpenAI fetch error:", errorMsg);

        await adminClient
          .from("generations")
          .update({ status: "failed", error: errorMsg })
          .eq("id", generation.id);

        return Response.json(
          { success: false, error: errorMsg },
          { status: 500 }
        );
      }

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
        console.log(
          `[generate-video] OpenAI returned b64_json, length: ${imageData.b64_json.length}`
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
          console.log(`[generate-video] Image saved successfully`);
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
            description: "GPT Image 1.5 图片生成扣费",
          });

          // Update charged_at after successful deduction
          await adminClient
            .from("generations")
            .update({ charged_at: new Date().toISOString() })
            .eq("id", generation.id);
        }

        console.log(`[generate-video] GPT Image 1.5 generation succeeded: ${shortUrl}`);

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

        // ── Deduct credits ──────────────────────────────────────────
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
            description: "GPT Image 1.5 图片生成扣费",
          });
        }

        const { error: updateError } = await adminClient
          .from("generations")
          .update({
            status: "succeeded",
            video_url: outputUrl,
            cover_url: outputUrl,
            charged_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        if (updateError) {
          console.error(
            "[generate-video] Failed to update generation record:",
            updateError
          );
        }

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
        settings: {
          aspectRatio: aspectRatio ?? "16:9",
          duration: duration ?? 10,
          quality: quality ?? "标准",
          style: style ?? "真实质感",
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

    // ── Submit to Seedance API ──────────────────────────────────────────
    const result = await submitVideoGeneration({
      prompt: prompt.trim(),
      aspectRatio,
      duration,
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
    console.error("[generate-video] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
