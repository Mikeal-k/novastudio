import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/cleanup-stale-generations
 *
 * Finds GPT Image 1.5 / GPT Image 2 tasks that have been stuck in
 * "running" or "pending" status for more than 3 minutes, and marks them
 * as "failed".
 *
 * For tasks where charged_at IS NOT null, it also refunds the credits.
 * For tasks where charged_at IS null, it does NOT refund (nothing was charged).
 *
 * Does NOT touch Seedance tasks (which have their own 10-minute timeout logic).
 *
 * Body (optional):
 *   { model?: "gpt-image-1.5" | "gpt-image-2" | "all" }
 *   - "all" (default): cleanup both GPT Image 1.5 and GPT Image 2
 *   - "gpt-image-1.5": only GPT Image 1.5
 *   - "gpt-image-2": only GPT Image 2
 */
export async function POST(_request: NextRequest) {
  try {
    // ── 1. Verify admin identity ─────────────────────────────────────────
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

    // ── 2. Parse optional filter ─────────────────────────────────────────
    let body: { model?: string } = {};
    try {
      body = await _request.json();
    } catch {
      // No body provided, use defaults
    }

    const modelFilter = body.model ?? "all";

    // ── 3. Build model display name filter ────────────────────────────────
    // The DB stores display names: "GPT Image 1.5", "GPT Image 2"
    const targetModels: string[] = [];
    if (modelFilter === "all" || modelFilter === "gpt-image-1.5") {
      targetModels.push("GPT Image 1.5");
    }
    if (modelFilter === "all" || modelFilter === "gpt-image-2") {
      targetModels.push("GPT Image 2");
    }

    if (targetModels.length === 0) {
      return Response.json(
        { success: false, error: "无效的模型过滤参数" },
        { status: 400 }
      );
    }

    // ── 4. Find stale tasks ──────────────────────────────────────────────
    const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    const cutoffTime = new Date(Date.now() - TIMEOUT_MS).toISOString();

    console.log(
      `[cleanup-stale] Searching for stale image tasks: models=${targetModels.join(",")} created_before=${cutoffTime}`
    );

    const { data: staleTasks, error: queryError } = await adminClient
      .from("generations")
      .select("id, user_id, model, status, cost, charged_at, created_at")
      .in("model", targetModels)
      .in("status", ["running", "pending"])
      .lt("created_at", cutoffTime)
      .order("created_at", { ascending: true });

    if (queryError) {
      console.error("[cleanup-stale] Query error:", queryError);
      return Response.json(
        { success: false, error: "查询失败" },
        { status: 500 }
      );
    }

    if (!staleTasks || staleTasks.length === 0) {
      return Response.json({
        success: true,
        message: "没有发现需要清理的卡死任务",
        cleaned: 0,
        refunded: 0,
        tasks: [],
      });
    }

    console.log(
      `[cleanup-stale] Found ${staleTasks.length} stale tasks to clean up`
    );

    // ── 5. Process each stale task ───────────────────────────────────────
    const results: Array<{
      id: string;
      model: string;
      status: string;
      charged: boolean;
      refunded: boolean;
      error: string;
    }> = [];

    for (const task of staleTasks) {
      try {
        const isCharged = !!task.charged_at;
        let refunded = false;

        // ── 5a. If charged, refund credits ───────────────────────────────
        if (isCharged) {
          // Check for existing refund to avoid double refund
          const { data: existingRefunds } = await adminClient
            .from("credit_transactions")
            .select("id")
            .eq("generation_id", task.id)
            .eq("type", "admin_refund");

          if (!existingRefunds || existingRefunds.length === 0) {
            // Get current user balance
            const { data: profile } = await adminClient
              .from("profiles")
              .select("credits")
              .eq("id", task.user_id)
              .single();

            if (profile) {
              const currentBalance = profile.credits ?? 0;
              const newBalance = currentBalance + (task.cost ?? 0);

              await adminClient
                .from("profiles")
                .update({ credits: newBalance, updated_at: new Date().toISOString() })
                .eq("id", task.user_id);

              await adminClient.from("credit_transactions").insert({
                user_id: task.user_id,
                type: "admin_refund",
                amount: task.cost ?? 0,
                balance_after: newBalance,
                generation_id: task.id,
                description: `超时任务自动退款（${task.model}，${task.cost} 积分）`,
              });

              refunded = true;
              console.log(
                `[cleanup-stale] Refunded ${task.cost} credits for task ${task.id}`
              );
            }
          } else {
            // Already refunded — don't refund again
            console.log(
              `[cleanup-stale] Task ${task.id} already refunded, skipping refund`
            );
          }
        }

        // ── 5b. Mark task as failed ──────────────────────────────────────
        const errorMsg = "图片生成任务超时（超过 3 分钟无响应），自动标记为失败";

        await adminClient
          .from("generations")
          .update({
            status: "failed",
            error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        results.push({
          id: task.id,
          model: task.model,
          status: "failed",
          charged: isCharged,
          refunded,
          error: errorMsg,
        });

        console.log(
          `[cleanup-stale] Task ${task.id} (${task.model}) marked as failed. charged=${isCharged} refunded=${refunded}`
        );
      } catch (processError) {
        const msg =
          processError instanceof Error
            ? processError.message
            : "处理失败";
        console.error(`[cleanup-stale] Failed to process task ${task.id}:`, msg);

        results.push({
          id: task.id,
          model: task.model,
          status: task.status,
          charged: !!task.charged_at,
          refunded: false,
          error: msg,
        });
      }
    }

    const chargedCount = results.filter((r) => r.charged).length;
    const refundedCount = results.filter((r) => r.refunded).length;

    console.log(
      `[cleanup-stale] Done. cleaned=${results.length} charged=${chargedCount} refunded=${refundedCount}`
    );

    return Response.json({
      success: true,
      message: `已清理 ${results.length} 个卡死任务，退款 ${refundedCount} 个`,
      cleaned: results.length,
      refunded: refundedCount,
      tasks: results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[cleanup-stale] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
