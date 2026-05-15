import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/users/[userId]
 *
 * Returns detailed info about a specific user.
 * Requires:
 *   - Valid Bearer token (logged-in user)
 *   - user.email === ADMIN_EMAIL
 */
export async function GET(
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
      console.error("[api/admin/users/$id] ADMIN_EMAIL not set");
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

    // ── 2. Resolve userId ──────────────────────────────────────────────
    const { userId } = await params;

    if (!userId) {
      return Response.json(
        { success: false, error: "缺少用户 ID" },
        { status: 400 }
      );
    }

    // ── 3. Fetch user profile ──────────────────────────────────────────
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return Response.json(
        { success: false, error: "用户不存在" },
        { status: 404 }
      );
    }

    // ── 4. Fetch auth user info (email, last sign in) ──────────────────
    let authUserEmail = profile.email ?? "";
    let lastSignInAt: string | null = null;
    try {
      const {
        data: { user: authUser },
      } = await adminClient.auth.admin.getUserById(userId);
      if (authUser) {
        authUserEmail = authUser.email ?? profile.email ?? "";
        lastSignInAt = authUser.last_sign_in_at ?? null;
      }
    } catch {
      // auth.users not accessible via admin client — fall back to profile
    }

    // ── 5. Fetch generation counts ─────────────────────────────────────
    let generationsCount = 0;
    let publicGenerationsCount = 0;
    let creditsConsumedTotal = 0;
    const { data: allGens } = await adminClient
      .from("generations")
      .select("cost, is_public")
      .eq("user_id", userId);
    if (allGens) {
      generationsCount = allGens.length;
      publicGenerationsCount = allGens.filter((g) => g.is_public).length;
      creditsConsumedTotal = allGens.reduce(
        (sum, g) => sum + (g.cost ?? 0),
        0
      );
    }

    // ── 6. Fetch recharge totals ───────────────────────────────────────
    let rechargeAmountTotal = 0;
    const { data: paidOrders } = await adminClient
      .from("recharge_orders")
      .select("amount_yuan")
      .eq("user_id", userId)
      .eq("status", "paid");
    if (paidOrders) {
      rechargeAmountTotal = paidOrders.reduce(
        (sum, o) => sum + Number(o.amount_yuan),
        0
      );
    }

    // ── 7. Fetch recent generations (limit 10) ─────────────────────────
    const { data: recentGenerationsRaw } = await adminClient
      .from("generations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentGenerations = (recentGenerationsRaw ?? []).map((g) => ({
      id: g.id,
      model: g.model,
      status: g.status,
      cost: g.cost ?? 0,
      prompt: g.prompt ?? "",
      createdAt: g.created_at,
      error: g.error ?? null,
    }));

    // ── 8. Fetch recent recharge orders (limit 10) ─────────────────────
    const { data: recentOrdersRaw } = await adminClient
      .from("recharge_orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentRechargeOrders = (recentOrdersRaw ?? []).map((o) => ({
      id: o.id,
      amountYuan: Number(o.amount_yuan),
      credits: o.credits,
      status: o.status,
      packageName: o.package_name,
      createdAt: o.created_at,
    }));

    // ── 9. Fetch recent credit transactions (limit 20) ─────────────────
    const { data: recentTxsRaw } = await adminClient
      .from("credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const recentCreditTransactions = (recentTxsRaw ?? []).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balance_after,
      description: tx.description ?? "",
      createdAt: tx.created_at,
    }));

    // ── 10. Build response ─────────────────────────────────────────────
    return Response.json({
      success: true,
      user: {
        id: profile.id,
        email: authUserEmail,
        displayName: authUserEmail.split("@")[0] ?? "未知用户",
        avatarUrl: null as string | null,
        credits: profile.credits ?? 0,
        createdAt: profile.created_at,
        lastSignInAt,
        generationsCount,
        rechargeAmountTotal,
        creditsConsumedTotal,
        publicGenerationsCount,
        status: "正常",
      },
      recentGenerations,
      recentRechargeOrders,
      recentCreditTransactions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/users/$id] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
