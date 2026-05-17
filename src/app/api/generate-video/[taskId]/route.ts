import { NextRequest } from "next/server";
import { queryVideoTask } from "@/lib/seedance";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────
    const authHeader = _request.headers.get("Authorization");
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

    const { taskId } = await params;

    if (!taskId) {
      return Response.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    // ── Find the generation record for this user + task ─────────────────
    const { data: generation, error: genError } = await adminClient
      .from("generations")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .single();

    if (genError || !generation) {
      return Response.json(
        { success: false, error: "未找到对应的生成记录" },
        { status: 404 }
      );
    }

    // ── Query Seedance task status ──────────────────────────────────────
    const result = await queryVideoTask(taskId);

    switch (result.status) {
      case "pending":
      case "running": {
        // ── Timeout check: if task has been running > 10 min, mark as failed ──
        const createdAt = new Date(generation.created_at).getTime();
        const now = Date.now();
        const TEN_MINUTES_MS = 10 * 60 * 1000;

        if (now - createdAt > TEN_MINUTES_MS && !generation.charged_at) {
          console.log(
            `[seedance/query] Task ${taskId} timed out (created at ${generation.created_at}, status ${generation.status})`
          );

          await adminClient
            .from("generations")
            .update({
              status: "failed",
              error: "生成超时，请重新生成。未扣除积分。",
              updated_at: new Date().toISOString(),
            })
            .eq("id", generation.id);

          return Response.json({
            success: false,
            status: "failed",
            error: "生成超时，请重新生成。未扣除积分。",
          });
        }

        return Response.json({
          success: true,
          status: result.status,
        });
      }

      case "succeeded": {
        const tempVideoUrl = result.result?.video_url ?? null;
        const tempCoverUrl = result.result?.cover_url ?? null;

        console.log(
          `[seedance/query] Task ${taskId} succeeded. ` +
          `tempVideoUrl=${tempVideoUrl ?? "(null)"} ` +
          `tempCoverUrl=${tempCoverUrl ?? "(null)"}`
        );

        // ── If Seedance didn't return a video URL, mark as failed ────
        if (!tempVideoUrl) {
          console.error(
            `[seedance/query] Task ${taskId} succeeded but no video_url in response. ` +
            `Content: ${JSON.stringify(result)}`
          );
          await adminClient
            .from("generations")
            .update({
              status: "failed",
              error: "视频地址未就绪，请重新生成或联系客服",
              updated_at: new Date().toISOString(),
            })
            .eq("id", generation.id);

          return Response.json({
            success: false,
            status: "failed",
            error: "视频地址未就绪，请重新生成或联系客服",
          });
        }

        // ── Download video and cover to local storage ──────────────────
        let localVideoUrl: string | null = null;
        let localCoverUrl: string | null = null;
        let downloadFailed = false;

        try {
          const fileName = `generation-${generation.id}.mp4`;
          const relativeDir = "generated/seedance";
          const publicDir = path.join(process.cwd(), "public", relativeDir);
          const filePath = path.join(publicDir, fileName);

          console.log(`[seedance/query] Downloading video from: ${tempVideoUrl}`);
          console.log(`[seedance/query] Saving to: ${filePath}`);

          fs.mkdirSync(publicDir, { recursive: true });

          const response = await fetch(tempVideoUrl);
          if (!response.ok) {
            throw new Error(`Failed to download video: HTTP ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

          localVideoUrl = `/${relativeDir}/${fileName}`;
          console.log(`[seedance/query] Video saved: ${localVideoUrl}`);
        } catch (downloadErr) {
          console.error(`[seedance/query] Failed to download video from ${tempVideoUrl}:`, downloadErr);
          downloadFailed = true;
        }

        if (tempCoverUrl && !downloadFailed) {
          try {
            const ext = tempCoverUrl.match(/\.(png|jpg|jpeg|webp|gif)(\?|$)/i)?.[1] || "jpg";
            const coverFileName = `generation-${generation.id}-cover.${ext}`;
            const relativeDir = "generated/seedance";
            const publicDir = path.join(process.cwd(), "public", relativeDir);
            const coverFilePath = path.join(publicDir, coverFileName);

            console.log(`[seedance/query] Downloading cover from: ${tempCoverUrl}`);

            fs.mkdirSync(publicDir, { recursive: true });

            const coverResponse = await fetch(tempCoverUrl);
            if (!coverResponse.ok) {
              throw new Error(`Failed to download cover: HTTP ${coverResponse.status}`);
            }

            const coverArrayBuffer = await coverResponse.arrayBuffer();
            fs.writeFileSync(coverFilePath, Buffer.from(coverArrayBuffer));

            localCoverUrl = `/${relativeDir}/${coverFileName}`;
            console.log(`[seedance/query] Cover saved: ${localCoverUrl}`);
          } catch (downloadErr) {
            console.error(`[seedance/query] Failed to download cover:`, downloadErr);
            // Cover download failure is non-fatal — still use video
            localCoverUrl = null;
          }
        }

        // ── If video download failed, try using tempVideoUrl directly ──
        // (User can still download from Seedance CDN even if local save failed)
        if (downloadFailed) {
          console.warn(
            `[seedance/query] Local video save failed for task ${taskId}. ` +
            `Falling back to Seedance temp URL: ${tempVideoUrl}`
          );
        }

        // ── Update generation record ───────────────────────────────────
        // Priority: localVideoUrl > tempVideoUrl (Seedance CDN)
        // NEVER fall back to cover_url or reference image URL for video_url
        const finalVideoUrl = localVideoUrl || (downloadFailed ? tempVideoUrl : tempVideoUrl);
        const finalCoverUrl = localCoverUrl || tempCoverUrl;

        console.log(
          `[seedance/query] Saving to DB -> ` +
          `video_url=${finalVideoUrl ?? "(null)"} ` +
          `cover_url=${finalCoverUrl ?? "(null)"} ` +
          `downloadFailed=${downloadFailed}`
        );

        const updates: Record<string, unknown> = {
          status: "succeeded",
          video_url: finalVideoUrl,
          cover_url: finalCoverUrl,
          updated_at: new Date().toISOString(),
        };

        // ── Idempotent credit deduction ────────────────────────────────
        if (!generation.charged_at) {
          const cost = generation.cost;

          const { data: profile } = await adminClient
            .from("profiles")
            .select("credits")
            .eq("id", user.id)
            .single();

          if (profile) {
            const newBalance = profile.credits - cost;

            await adminClient
              .from("profiles")
              .update({ credits: newBalance, updated_at: new Date().toISOString() })
              .eq("id", user.id);

            // Record transaction
            await adminClient.from("credit_transactions").insert({
              user_id: user.id,
              type: "generation_debit",
              amount: -cost,
              balance_after: newBalance,
              generation_id: generation.id,
              description: "Seedance 视频生成扣费",
            });

            updates.charged_at = new Date().toISOString();
          }
        }

        // ── Clean up reference image markers from settings (Bug 3 fix) ──────
        const currentSettings = generation.settings || {};
        if (currentSettings.hasReferenceImage || currentSettings.referenceImageMode) {
          const cleanedSettings = { ...currentSettings };
          delete cleanedSettings.hasReferenceImage;
          delete cleanedSettings.referenceImageMode;
          updates.settings = cleanedSettings;
        }

        await adminClient
          .from("generations")
          .update(updates)
          .eq("id", generation.id);

        return Response.json({
          success: true,
          status: "succeeded",
          videoUrl: localVideoUrl || tempVideoUrl,
          coverUrl: localCoverUrl || tempCoverUrl,
        });
      }

      case "failed":
      case "canceled": {
        // ── Clean up reference image markers from settings (Bug 3 fix) ──────
        const currentSettings: Record<string, unknown> = generation.settings || {};
        const hasRefMarkers = Boolean(currentSettings.hasReferenceImage || currentSettings.referenceImageMode);
        const failUpdates: Record<string, unknown> = {
          status: "failed",
          error: result.error ?? "Video generation failed",
          updated_at: new Date().toISOString(),
        };
        if (hasRefMarkers) {
          const cleaned: Record<string, unknown> = { ...currentSettings };
          delete cleaned.hasReferenceImage;
          delete cleaned.referenceImageMode;
          failUpdates.settings = cleaned;
        }

        // Update status to failed — do NOT deduct credits
        await adminClient
          .from("generations")
          .update(failUpdates)
          .eq("id", generation.id);

        return Response.json({
          success: true,
          status: "failed",
          error: result.error ?? "视频生成失败",
        });
      }

      default:
        return Response.json({
          success: true,
          status: "running",
        });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[generate-video/query] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
