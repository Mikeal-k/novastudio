import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/users/[userId]/credits
 *
 * Manually adjust a user's credits (add or subtract).
 * Requires:
 *   - Valid Bearer token (logged-in user)
 *   - user.email === ADMIN_EMAIL
 *
 * Body:
 *   amount  - Integer, positive to add, negative to subtract (cannot be 0)
 *   reason  - Required, at least 2 characters
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // ── 1. Verify admin identity ───────────────────────────────────────
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
      data: { user: adminUser },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !adminUser) {
      return Response.json(
        { success: false, error: "认证失败，请重新登录" },
        { status: 401 }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error("[api/admin/users/$id/credits] ADMIN_EMAIL not set");
      return Response.json(
        { success: false, error: "服务端未配置管理员邮箱" },
        { status: 500 }
      );
    }

    if (adminUser.email !== adminEmail) {
      return Response.json(
        { success: false, error: "无权限访问" },
        { status: 403 }
      );
    }

    // ── 2. Resolve userId ──────────────────────────────────────────────
    const { userId } = await params;

    if (!userId) {
      return Response.json(
        { success: false, error: "缺少用户 ID" },
        { status: 400 }
      );
    }

    // ── 3. Parse and validate request body ─────────────────────────────
    const body = (await request.json()) as {
      amount?: number;
      reason?: string;
    };

    const { amount, reason } = body;

    // amount must be an integer
    if (typeof amount !== "number" || !Number.isInteger(amount)) {
      return Response.json(
        { success: false, error: "积分调整数量必须是整数" },
        { status: 400 }
      );
    }

    // amount cannot be 0
    if (amount === 0) {
      return Response.json(
        { success: false, error: "积分调整数量不能为 0" },
        { status: 400 }
      );
    }

    // reason is required, at least 2 characters
    if (!reason || typeof reason !== "string" || reason.trim().length < 2) {
      return Response.json(
        { success: false, error: "操作原因至少 2 个字" },
        { status: 400 }
      );
    }

    // ── 4. Fetch current profile ───────────────────────────────────────
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return Response.json(
        { success: false, error: "用户不存在" },
        { status: 404 }
      );
    }

    const currentCredits = profile.credits ?? 0;
    const newCredits = currentCredits + amount;

    // Cannot go below 0
    if (newCredits < 0) {
      return Response.json(
        {
          success: false,
          error: `积分不足，当前积分 ${currentCredits}，无法扣除 ${Math.abs(amount)} 积分`,
        },
        { status: 400 }
      );
    }

    // ── 5. Update credits ──────────────────────────────────────────────
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) {
      console.error(
        "[api/admin/users/$id/credits] Update error:",
        updateError
      );
      return Response.json(
        { success: false, error: "更新积分失败" },
        { status: 500 }
      );
    }

    // ── 6. Insert credit transaction ───────────────────────────────────
    const { error: txError } = await adminClient
      .from("credit_transactions")
      .insert({
        user_id: userId,
        type: "admin_adjustment",
        amount,
        balance_after: newCredits,
        description: `管理员调整：${reason.trim()}`,
      });

    if (txError) {
      console.error(
        "[api/admin/users/$id/credits] Transaction insert error:",
        txError
      );
      // Credits already updated — log the error but don't fail the request
      console.error(
        "[api/admin/users/$id/credits] Credits were updated but transaction record failed"
      );
    }

    // ── 7. Return success ──────────────────────────────────────────────
    const actionLabel = amount > 0 ? "增加" : "扣除";
    return Response.json({
      success: true,
      message: `已为用户${actionLabel} ${Math.abs(amount)} 积分`,
      newCredits,
      previousCredits: currentCredits,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/users/$id/credits] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
