import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // ── 1. Verify admin secret ─────────────────────────────────────────
    const adminSecret = request.headers.get("x-admin-secret");
    const expectedSecret = process.env.ADMIN_RECHARGE_SECRET;

    if (!expectedSecret) {
      console.error("[api/admin/recharge/approve] ADMIN_RECHARGE_SECRET not set");
      return Response.json(
        { success: false, error: "服务端未配置管理员密钥" },
        { status: 500 }
      );
    }

    if (!adminSecret || adminSecret !== expectedSecret) {
      return Response.json(
        { success: false, error: "管理员密钥无效" },
        { status: 401 }
      );
    }

    // ── 2. Parse request body ──────────────────────────────────────────
    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId;

    if (!orderId) {
      return Response.json(
        { success: false, error: "请提供订单 ID" },
        { status: 400 }
      );
    }

    const adminClient = createAdminSupabaseClient();

    // ── 3. Fetch the order ─────────────────────────────────────────────
    const { data: order, error: fetchError } = await adminClient
      .from("recharge_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return Response.json(
        { success: false, error: "订单不存在" },
        { status: 404 }
      );
    }

    // ── 4. Validate order status ───────────────────────────────────────
    if (order.status !== "pending") {
      return Response.json(
        {
          success: false,
          error: `订单状态不是 pending，当前状态: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // ── 5. Approve: update order, add credits, insert transaction ──────
    // Use a transaction-like approach with Supabase

    // 5a. Update order status to paid
    const { error: updateOrderError } = await adminClient
      .from("recharge_orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateOrderError) {
      console.error("[api/admin/recharge/approve] Update order error:", updateOrderError);
      return Response.json(
        { success: false, error: "更新订单状态失败" },
        { status: 500 }
      );
    }

    // 5b. Fetch current credits
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", order.user_id)
      .single();

    if (profileError || !profile) {
      console.error("[api/admin/recharge/approve] Fetch profile error:", profileError);
      return Response.json(
        { success: false, error: "获取用户资料失败" },
        { status: 500 }
      );
    }

    const currentCredits = profile.credits;
    const newCredits = currentCredits + order.credits;

    // 5c. Update credits
    const { error: updateCreditsError } = await adminClient
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", order.user_id);

    if (updateCreditsError) {
      console.error("[api/admin/recharge/approve] Update credits error:", updateCreditsError);
      return Response.json(
        { success: false, error: "更新用户积分失败" },
        { status: 500 }
      );
    }

    // 5d. Insert credit transaction
    const { error: txError } = await adminClient
      .from("credit_transactions")
      .insert({
        user_id: order.user_id,
        type: "purchase_credit",
        amount: order.credits,
        balance_after: newCredits,
        description: `人工确认充值：${order.package_name}`,
      });

    if (txError) {
      console.error("[api/admin/recharge/approve] Insert transaction error:", txError);
      // Credits already added — log the error but don't fail the request
      console.error("[api/admin/recharge/approve] Credits were added but transaction record failed");
    }

    return Response.json({
      success: true,
      message: `订单已确认，已为用户增加 ${order.credits} 积分`,
      newCredits,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/recharge/approve] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
