import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/recharge/orders
 *
 * Returns pending recharge orders for the admin panel.
 * Requires:
 *   - Valid Bearer token (logged-in user)
 *   - user.email === ADMIN_EMAIL
 *
 * No Admin Secret required — just admin login.
 */
export async function GET(request: NextRequest) {
  try {
    // ── 1. Verify admin identity via login session ─────────────────────
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
      console.error("[api/admin/recharge/orders] ADMIN_EMAIL not set");
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
    const statusFilter = searchParams.get("status"); // "pending" | "all" | null

    // ── 3. Build query ─────────────────────────────────────────────────
    let query = adminClient
      .from("recharge_orders")
      .select("*");

    if (statusFilter === "all") {
      // No status filter — return all
    } else {
      // Default: only pending orders
      query = query.eq("status", "pending");
    }

    // Order: pending first, then by created_at desc
    query = query.order("status", { ascending: true });
    query = query.order("created_at", { ascending: false });

    // Limit to 50
    query = query.limit(50);

    const { data: orders, error: fetchError } = await query;

    if (fetchError) {
      console.error("[api/admin/recharge/orders] Fetch error:", fetchError);
      return Response.json(
        { success: false, error: "查询订单列表失败" },
        { status: 500 }
      );
    }

    // ── 4. Enrich with user emails ─────────────────────────────────────
    // Collect unique user IDs
    const userIds = [...new Set((orders ?? []).map((o) => o.user_id))];

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

    // ── 5. Format response ────────────────────────────────────────────
    const formattedOrders = (orders ?? []).map((order) => ({
      id: order.id,
      userId: order.user_id,
      userEmail: userEmailMap[order.user_id] ?? "",
      packageName: order.package_name,
      amountYuan: order.amount_yuan,
      credits: order.credits,
      status: order.status,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      remarkCode: (order.id as string).slice(-6).toUpperCase(),
    }));

    return Response.json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/recharge/orders] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
