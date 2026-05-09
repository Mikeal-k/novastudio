import { NextRequest } from "next/server";
import { queryVideoTask } from "@/lib/seedance";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
      case "running":
        return Response.json({
          success: true,
          status: result.status,
        });

      case "succeeded": {
        const videoUrl = result.result?.video_url ?? null;
        const coverUrl = result.result?.cover_url ?? null;

        // Update generation record
        const updates: Record<string, unknown> = {
          status: "succeeded",
          video_url: videoUrl,
          cover_url: coverUrl,
          updated_at: new Date().toISOString(),
        };

        // ── Idempotent credit deduction ────────────────────────────────
        // Only deduct credits if not already charged
        if (!generation.charged_at) {
          const cost = generation.cost;

          // Deduct credits from profile
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

        await adminClient
          .from("generations")
          .update(updates)
          .eq("id", generation.id);

        return Response.json({
          success: true,
          status: "succeeded",
          videoUrl,
          coverUrl,
        });
      }

      case "failed":
      case "canceled": {
        // Update status to failed — do NOT deduct credits
        await adminClient
          .from("generations")
          .update({
            status: "failed",
            error: result.error ?? "Video generation failed",
            updated_at: new Date().toISOString(),
          })
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
