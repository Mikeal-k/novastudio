import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { queryVideoTask } from "@/lib/seedance";

/**
 * POST /api/admin/generations/[id]/refresh
 *
 * Manually refresh the status of a Seedance 2.0 generation task by querying
 * the Ark API. Only works for Seedance 2.0 tasks that have a task_id.
 *
 * If the task succeeded, updates the record with video/cover URLs and
 * deducts credits (idempotent — respects charged_at).
 * If the task failed, updates the record as failed.
 * If still running, returns the current status.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1. Verify admin identity ───────────────────────────────────────
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

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return Response.json(
        { success: false, error: "服务端未配置管理员邮箱" },
        { status: 500 }
      );
    }

    if (user.email !== adminEmail) {
      return Response.json(
        { success: false, error: "无权限访问" },
        { status: 403 }
      );
    }

    // ── 2. Parse params and validate ──────────────────────────────────
    const { id } = await params;

    if (!id) {
      return Response.json(
        { success: false, error: "缺少生成任务 ID" },
        { status: 400 }
      );
    }

    // ── 3. Fetch generation record ────────────────────────────────────
    const { data: generation, error: genError } = await adminClient
      .from("generations")
      .select("*")
      .eq("id", id)
      .single();

    if (genError || !generation) {
      return Response.json(
        { success: false, error: "未找到生成任务" },
        { status: 404 }
      );
    }

    // ── 4. Validate: only Seedance 2.0 with task_id ───────────────────
    if (generation.model !== "seedance-2") {
      return Response.json(
        { success: false, error: "只支持刷新 Seedance 2.0 任务状态" },
        { status: 400 }
      );
    }

    if (!generation.task_id) {
      return Response.json(
        { success: false, error: "该任务没有关联的 task_id，无法刷新" },
        { status: 400 }
      );
    }

    // ── 5. Query Seedance API ─────────────────────────────────────────
    console.log(
      `[admin/generations/refresh] Refreshing task ${generation.task_id} for generation ${id}`
    );

    const result = await queryVideoTask(generation.task_id);

    switch (result.status) {
      case "pending":
      case "running": {
        // Still in progress — update status but don't deduct credits
        await adminClient
          .from("generations")
          .update({
            status: result.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        return Response.json({
          success: true,
          status: result.status,
          message: "任务仍在生成中",
        });
      }

      case "succeeded": {
        // ── Update with result data ──────────────────────────────────
        const updates: Record<string, unknown> = {
          status: "succeeded",
          video_url: result.result?.video_url ?? generation.video_url,
          cover_url: result.result?.cover_url ?? generation.cover_url,
          updated_at: new Date().toISOString(),
        };

        // ── Idempotent credit deduction ──────────────────────────────
        if (!generation.charged_at) {
          const cost = generation.cost;

          const { data: profile } = await adminClient
            .from("profiles")
            .select("credits")
            .eq("id", generation.user_id)
            .single();

          if (profile) {
            const newBalance = profile.credits - cost;

            await adminClient
              .from("profiles")
              .update({
                credits: newBalance,
                updated_at: new Date().toISOString(),
              })
              .eq("id", generation.user_id);

            await adminClient.from("credit_transactions").insert({
              user_id: generation.user_id,
              type: "generation_debit",
              amount: -cost,
              balance_after: newBalance,
              generation_id: generation.id,
              description: "Seedance 视频生成扣费（管理后台刷新）",
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
          videoUrl: updates.video_url,
          coverUrl: updates.cover_url,
          message: "任务已完成，已更新视频信息",
        });
      }

      case "failed":
      case "canceled": {
        // Update as failed — only if not already succeeded
        if (generation.status !== "succeeded") {
          await adminClient
            .from("generations")
            .update({
              status: "failed",
              error: result.error ?? "Seedance 生成失败",
              updated_at: new Date().toISOString(),
            })
            .eq("id", generation.id);
        }

        return Response.json({
          success: true,
          status: "failed",
          error: result.error ?? "Seedance 生成失败",
          message: "任务已标记为失败",
        });
      }

      default:
        return Response.json({
          success: true,
          status: "running",
          message: "任务状态未知，请稍后重试",
        });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[admin/generations/refresh] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
