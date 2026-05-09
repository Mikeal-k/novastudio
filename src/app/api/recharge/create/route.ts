import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// ─── Server-side package definitions (NOT trusted from frontend) ────────────

const PACKAGES = {
  experience: { name: "体验包", amountYuan: 29.9, credits: 150 },
  standard: { name: "标准包", amountYuan: 69.9, credits: 400 },
  pro: { name: "专业包", amountYuan: 199, credits: 1200 },
} as const;

type PackageId = keyof typeof PACKAGES;

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate user ───────────────────────────────────────────
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

    // ── 2. Validate package ────────────────────────────────────────────
    const body = (await request.json()) as { packageId?: string };
    const packageId = body.packageId as PackageId | undefined;

    if (!packageId || !(packageId in PACKAGES)) {
      return Response.json(
        { success: false, error: "无效的套餐 ID" },
        { status: 400 }
      );
    }

    const pkg = PACKAGES[packageId];

    // ── 3. Create recharge order ───────────────────────────────────────
    const { data: order, error: insertError } = await adminClient
      .from("recharge_orders")
      .insert({
        user_id: user.id,
        package_name: pkg.name,
        amount_yuan: pkg.amountYuan,
        credits: pkg.credits,
        status: "pending",
      })
      .select("id, package_name, amount_yuan, credits, status, created_at")
      .single();

    if (insertError || !order) {
      console.error("[api/recharge/create] Insert error:", insertError);
      return Response.json(
        { success: false, error: "创建充值订单失败" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      orderId: order.id,
      order: {
        id: order.id,
        packageName: order.package_name,
        amountYuan: order.amount_yuan,
        credits: order.credits,
        status: order.status,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/recharge/create] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
