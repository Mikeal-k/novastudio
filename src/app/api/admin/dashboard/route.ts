import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/dashboard
 *
 * Returns aggregated business dashboard stats for the admin panel.
 * Requires:
 *   - Valid Bearer token (logged-in user)
 *   - user.email === ADMIN_EMAIL
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
      console.error("[api/admin/dashboard] ADMIN_EMAIL not set");
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

    // ── 2. Compute "today" bounds (server local time) ──────────────────
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0, 0
    );
    const todayStartISO = todayStart.toISOString();

    // ── 3. Run all queries in parallel ─────────────────────────────────

    // 3a. Profile stats
    const [
      profilesCountResult,
      profilesTodayResult,
      profilesBalanceResult,
      generationsAllResult,
      generationsTodayResult,
      generationsSucceededTodayResult,
      generationsFailedTodayResult,
      generationModelsResult,
      rechargeOrdersResult,
      recentOrdersRaw,
      recentGenerationsRaw,
    ] = await Promise.allSettled([
      // Total users
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true }),

      // Users today
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStartISO),

      // Total credits balance
      adminClient
        .from("profiles")
        .select("credits"),

      // Total generations
      adminClient
        .from("generations")
        .select("id", { count: "exact", head: true }),

      // Generations today
      adminClient
        .from("generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStartISO),

      // Succeeded today
      adminClient
        .from("generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStartISO)
        .eq("status", "succeeded"),

      // Failed today
      adminClient
        .from("generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStartISO)
        .eq("status", "failed"),

      // Model stats (all time)
      adminClient
        .from("generations")
        .select("model, status, cost, created_at"),

      // Recharge orders (for totals — paid only)
      adminClient
        .from("recharge_orders")
        .select("amount_yuan, credits, status, created_at"),

      // Recent 5 orders
      adminClient
        .from("recharge_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),

      // Recent 10 generations
      adminClient
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // ── 4. Extract results ────────────────────────────────────────────

    // Users
    const usersTotal =
      profilesCountResult.status === "fulfilled"
        ? profilesCountResult.value.count ?? 0
        : 0;

    const usersToday =
      profilesTodayResult.status === "fulfilled"
        ? profilesTodayResult.value.count ?? 0
        : null; // null = unavailable

    // Credits balance
    let creditsBalanceTotal: number | null = null;
    if (
      profilesBalanceResult.status === "fulfilled" &&
      profilesBalanceResult.value.data
    ) {
      creditsBalanceTotal = profilesBalanceResult.value.data.reduce(
        (sum, p) => sum + (p.credits ?? 0),
        0
      );
    }

    // Generations
    const generationsTotal =
      generationsAllResult.status === "fulfilled"
        ? generationsAllResult.value.count ?? 0
        : 0;

    const generationsToday =
      generationsTodayResult.status === "fulfilled"
        ? generationsTodayResult.value.count ?? 0
        : null;

    const generationsSucceededToday =
      generationsSucceededTodayResult.status === "fulfilled"
        ? generationsSucceededTodayResult.value.count ?? 0
        : null;

    const generationsFailedToday =
      generationsFailedTodayResult.status === "fulfilled"
        ? generationsFailedTodayResult.value.count ?? 0
        : null;

    // Recharge totals
    let rechargeAmountTotal = 0;
    let rechargeAmountToday = 0;
    if (
      rechargeOrdersResult.status === "fulfilled" &&
      rechargeOrdersResult.value.data
    ) {
      for (const order of rechargeOrdersResult.value.data) {
        if (order.status === "paid") {
          rechargeAmountTotal += Number(order.amount_yuan) || 0;
          if (
            order.created_at &&
            new Date(order.created_at) >= todayStart
          ) {
            rechargeAmountToday += Number(order.amount_yuan) || 0;
          }
        }
      }
    }

    // Credits consumed from credit_transactions (type = generation_debit)
    let creditsConsumedTotal = 0;
    let creditsConsumedToday = 0;
    try {
      const { data: allDebitTxs } = await adminClient
        .from("credit_transactions")
        .select("amount, created_at")
        .eq("type", "generation_debit");

      if (allDebitTxs) {
        for (const tx of allDebitTxs) {
          const amt = Math.abs(tx.amount ?? 0);
          creditsConsumedTotal += amt;
          if (tx.created_at && new Date(tx.created_at) >= todayStart) {
            creditsConsumedToday += amt;
          }
        }
      }
    } catch {
      // If the table is unavailable, values remain 0
    }

    // Public generations
    let publicGenerationsTotal = 0;
    try {
      const { count: pubCount } = await adminClient
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true);
      publicGenerationsTotal = pubCount ?? 0;
    } catch {
      // remain 0
    }

    // ── 5. Model stats ────────────────────────────────────────────────
    const modelMap = new Map<
      string,
      {
        total: number;
        today: number;
        succeeded: number;
        failed: number;
        running: number;
        creditsConsumed: number;
      }
    >();

    if (
      generationModelsResult.status === "fulfilled" &&
      generationModelsResult.value.data
    ) {
      for (const g of generationModelsResult.value.data) {
        const model = g.model || "unknown";
        if (!modelMap.has(model)) {
          modelMap.set(model, {
            total: 0,
            today: 0,
            succeeded: 0,
            failed: 0,
            running: 0,
            creditsConsumed: 0,
          });
        }
        const entry = modelMap.get(model)!;
        entry.total += 1;

        const createdAt = g.created_at
          ? new Date(g.created_at)
          : null;
        if (createdAt && createdAt >= todayStart) {
          entry.today += 1;
        }

        if (g.status === "succeeded") {
          entry.succeeded += 1;
        } else if (g.status === "failed") {
          entry.failed += 1;
        } else if (
          g.status === "running" ||
          g.status === "pending" ||
          g.status === "processing"
        ) {
          entry.running += 1;
        }

        entry.creditsConsumed += g.cost ?? 0;
      }
    }

    const modelStats = Array.from(modelMap.entries())
      .map(([model, stats]) => {
        const failRate =
          stats.total > 0
            ? Math.round((stats.failed / stats.total) * 1000) / 10
            : 0;
        const successRate =
          stats.total > 0
            ? Math.round((stats.succeeded / stats.total) * 1000) / 10
            : 0;
        return {
          model,
          total: stats.total,
          today: stats.today,
          succeeded: stats.succeeded,
          failed: stats.failed,
          running: stats.running,
          successRate,
          failRate,
          creditsConsumed: stats.creditsConsumed,
        };
      })
      .sort((a, b) => b.total - a.total);

    // ── 6. Recent orders (enrich with user emails) ────────────────────
    let recentOrders: Array<{
      id: string;
      userEmail: string;
      amount: number;
      credits: number;
      status: string;
      createdAt: string;
    }> = [];

    if (
      recentOrdersRaw.status === "fulfilled" &&
      recentOrdersRaw.value.data
    ) {
      const rawOrders = recentOrdersRaw.value.data;
      const userIds = [
        ...new Set(rawOrders.map((o: { user_id: string }) => o.user_id)),
      ] as string[];

      const userEmailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        if (profiles) {
          for (const p of profiles) {
            userEmailMap[p.id] = p.email ?? "";
          }
        }
      }

      recentOrders = rawOrders.map(
        (o: {
          id: string;
          user_id: string;
          amount_yuan: number;
          credits: number;
          status: string;
          created_at: string;
        }) => ({
          id: o.id,
          userEmail: userEmailMap[o.user_id] ?? "",
          amount: Number(o.amount_yuan) || 0,
          credits: o.credits,
          status: o.status,
          createdAt: o.created_at,
        })
      );
    }

    // ── 7. Recent generations (enrich with user emails) ───────────────
    let recentGenerations: Array<{
      id: string;
      userEmail: string;
      model: string;
      status: string;
      credits: number;
      prompt: string;
      createdAt: string;
      error: string | null;
    }> = [];

    if (
      recentGenerationsRaw.status === "fulfilled" &&
      recentGenerationsRaw.value.data
    ) {
      const rawGens = recentGenerationsRaw.value.data;
      const userIds = [
        ...new Set(
          rawGens.map((g: { user_id: string }) => g.user_id)
        ),
      ] as string[];

      const userEmailMap2: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        if (profiles) {
          for (const p of profiles) {
            userEmailMap2[p.id] = p.email ?? "";
          }
        }
      }

      recentGenerations = rawGens.map(
        (g: {
          id: string;
          user_id: string;
          model: string;
          status: string;
          cost: number;
          prompt: string;
          created_at: string;
          error: string | null;
        }) => ({
          id: g.id,
          userEmail: userEmailMap2[g.user_id] ?? "",
          model: g.model,
          status: g.status,
          credits: g.cost ?? 0,
          prompt: g.prompt ?? "",
          createdAt: g.created_at,
          error: g.error ?? null,
        })
      );
    }

    // ── 8. Build summary stats ────────────────────────────────────────
    const todayFailed = generationsFailedToday;
    const todayTotal = generationsToday;
    const failRateToday =
      todayTotal !== null && todayTotal > 0 && todayFailed !== null
        ? Math.round((todayFailed / todayTotal) * 1000) / 10
        : 0;

    return Response.json({
      success: true,
      stats: {
        usersTotal,
        usersToday,
        generationsTotal,
        generationsToday,
        generationsSucceededToday,
        generationsFailedToday,
        failRateToday,
        rechargeAmountTotal,
        rechargeAmountToday,
        creditsConsumedTotal,
        creditsConsumedToday,
        creditsBalanceTotal,
        publicGenerationsTotal,
      },
      modelStats,
      recentOrders,
      recentGenerations,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/dashboard] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
