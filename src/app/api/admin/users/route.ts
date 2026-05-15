import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/users
 *
 * Returns a paginated list of users for the admin panel.
 * Requires:
 *   - Valid Bearer token (logged-in user)
 *   - user.email === ADMIN_EMAIL
 *
 * Query params:
 *   q         - Search by email or display_name (partial match, case-insensitive)
 *   page      - Page number (1-based, default 1)
 *   pageSize  - Items per page (default 20, max 100)
 */
export async function GET(request: NextRequest) {
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
      console.error("[api/admin/users] ADMIN_EMAIL not set");
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

    // ── 2. Parse query params ─────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const offset = (page - 1) * pageSize;

    // ── 3. Build and run queries ───────────────────────────────────────
    let countQuery = adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true });

    let dataQuery = adminClient
      .from("profiles")
      .select("id, email, credits, created_at, updated_at");

    if (q) {
      const likePattern = `%${q}%`;
      countQuery = countQuery.or(`email.ilike.${likePattern}`);
      dataQuery = dataQuery
        .or(`email.ilike.${likePattern}`)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
    } else {
      dataQuery = dataQuery
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
    }

    const [countResult, dataResult] = await Promise.allSettled([
      countQuery,
      dataQuery,
    ]);

    const total =
      countResult.status === "fulfilled" ? countResult.value.count ?? 0 : 0;

    const profiles =
      dataResult.status === "fulfilled" ? dataResult.value.data ?? [] : [];

    // ── 4. Enrich with generation counts, recharge totals, credits consumed ──
    const userIds = profiles.map((p) => p.id);

    // Generations count per user
    const genCountMap: Record<string, number> = {};
    const creditsConsumedMap: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: genData } = await adminClient
        .from("generations")
        .select("user_id, cost")
        .in("user_id", userIds);
      if (genData) {
        for (const g of genData) {
          genCountMap[g.user_id] = (genCountMap[g.user_id] || 0) + 1;
          creditsConsumedMap[g.user_id] =
            (creditsConsumedMap[g.user_id] || 0) + (g.cost ?? 0);
        }
      }
    }

    // Recharge totals per user (paid only)
    const rechargeTotalMap: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: orderData } = await adminClient
        .from("recharge_orders")
        .select("user_id, amount_yuan")
        .in("user_id", userIds)
        .eq("status", "paid");
      if (orderData) {
        for (const o of orderData) {
          rechargeTotalMap[o.user_id] =
            (rechargeTotalMap[o.user_id] || 0) + Number(o.amount_yuan);
        }
      }
    }

    // ── 5. Format users ────────────────────────────────────────────────
    const users = profiles.map((p) => ({
      id: p.id,
      email: p.email ?? "",
      displayName: p.email?.split("@")[0] ?? "未知用户",
      avatarUrl: null as string | null,
      credits: p.credits ?? 0,
      createdAt: p.created_at,
      lastSignInAt: null as string | null,
      generationsCount: genCountMap[p.id] ?? 0,
      rechargeAmountTotal: rechargeTotalMap[p.id] ?? 0,
      creditsConsumedTotal: creditsConsumedMap[p.id] ?? 0,
      status: "正常",
    }));

    // ── 6. Compute summary stats ───────────────────────────────────────
    const totalCreditsBalance = users.reduce(
      (sum, u) => sum + (u.credits ?? 0),
      0
    );
    const paidUserCount = users.filter(
      (u) => (u.rechargeAmountTotal ?? 0) > 0
    ).length;

    return Response.json({
      success: true,
      users,
      total,
      page,
      pageSize,
      stats: {
        usersTotal: total,
        searchResultCount: users.length,
        totalCreditsBalance,
        paidUserCount,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/users] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
