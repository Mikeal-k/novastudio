import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/generations/[id]/refund
 *
 * Manually refund credits for a failed generation task.
 *
 * Body:
 *   { reason: string }
 *
 * Requirements:
 *   - Only works on tasks with status = "failed"
 *   - Only if charged_at is NOT null AND credits > 0
 *   - Prevents duplicate refund: checks credit_transactions for existing refund
 *   - Credits are added back to the user's profile
 *   - A credit_transaction record is created with type "admin_refund"
 *   - Does NOT modify recharge orders
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

    // ── 2. Parse body and params ───────────────────────────────────────
    const body = await _request.json();
    const reason = (body.reason ?? "").trim();

    if (!reason) {
      return Response.json(
        { success: false, error: "请填写退款原因" },
        { status: 400 }
      );
    }

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

    // ── 4. Validate refund eligibility ────────────────────────────────
    if (generation.status !== "failed") {
      return Response.json(
        { success: false, error: "只能对失败的任务退款" },
        { status: 400 }
      );
    }

    if (!generation.charged_at) {
      return Response.json(
        { success: false, error: "该任务未扣除积分，无需退款" },
        { status: 400 }
      );
    }

    const creditsToRefund = generation.cost ?? 0;
    if (creditsToRefund <= 0) {
      return Response.json(
        { success: false, error: "该任务没有可退款的积分" },
        { status: 400 }
      );
    }

    // ── 5. Prevent duplicate refund ───────────────────────────────────
    const { data: existingRefunds } = await adminClient
      .from("credit_transactions")
      .select("id, type, amount")
      .eq("generation_id", generation.id)
      .eq("type", "admin_refund");

    if (existingRefunds && existingRefunds.length > 0) {
      return Response.json(
        {
          success: false,
          error: "该任务已经退款，不可重复退款",
          existingRefund: existingRefunds[0],
        },
        { status: 400 }
      );
    }

    // ── 6. Execute refund ─────────────────────────────────────────────
    // Get current balance
    const { data: profile } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", generation.user_id)
      .single();

    if (!profile) {
      return Response.json(
        { success: false, error: "未找到用户信息" },
        { status: 404 }
      );
    }

    const currentBalance = profile.credits ?? 0;
    const newBalance = currentBalance + creditsToRefund;

    // Update user credits
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generation.user_id);

    if (updateError) {
      console.error(
        "[admin/generations/refund] Failed to update credits:",
        updateError
      );
      return Response.json(
        { success: false, error: "退款失败：无法更新用户积分" },
        { status: 500 }
      );
    }

    // Record refund transaction
    const { error: txError } = await adminClient
      .from("credit_transactions")
      .insert({
        user_id: generation.user_id,
        type: "admin_refund",
        amount: creditsToRefund,
        balance_after: newBalance,
        generation_id: generation.id,
        description: `失败任务退款（${creditsToRefund} 积分）：${reason}`,
      });

    if (txError) {
      console.error(
        "[admin/generations/refund] Failed to record transaction:",
        txError
      );
      // Rollback credit update if transaction recording fails
      await adminClient
        .from("profiles")
        .update({
          credits: currentBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generation.user_id);

      return Response.json(
        { success: false, error: "退款失败：无法记录积分流水" },
        { status: 500 }
      );
    }

    console.log(
      `[admin/generations/refund] Refunded ${creditsToRefund} credits for generation ${id} to user ${generation.user_id}. Reason: ${reason}`
    );

    return Response.json({
      success: true,
      message: `已退款 ${creditsToRefund} 积分`,
      refundedCredits: creditsToRefund,
      newBalance,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[admin/generations/refund] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
