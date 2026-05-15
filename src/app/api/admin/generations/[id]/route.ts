import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/generations/[id]
 *
 * Returns detailed information about a single generation task, including:
 * - Basic generation info
 * - User info (email, current credits)
 * - Related credit transactions
 */
export async function GET(
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
      console.error("[api/admin/generations] ADMIN_EMAIL not set");
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

    // ── 2. Parse params ───────────────────────────────────────────────
    const { id } = await params;

    if (!id) {
      return Response.json(
        { success: false, error: "缺少生成任务 ID" },
        { status: 400 }
      );
    }

    // ── 3. Fetch generation ───────────────────────────────────────────
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

    // ── 4. Fetch user info ────────────────────────────────────────────
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, email, credits")
      .eq("id", generation.user_id)
      .single();

    // ── 5. Fetch related credit transactions ──────────────────────────
    const { data: transactions } = await adminClient
      .from("credit_transactions")
      .select("*")
      .eq("generation_id", generation.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // ── 5b. Compute timeout flag for image models ─────────────────────
    const IMAGE_MODELS = new Set(["gpt-image-1.5", "gpt-image-2"]);
    const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

    const isTimeout = ((): boolean => {
      if (!IMAGE_MODELS.has(generation.model)) return false;
      if (generation.status !== "running" && generation.status !== "pending") return false;
      const elapsed = Date.now() - new Date(generation.created_at).getTime();
      return elapsed > TIMEOUT_MS;
    })();

    // ── 5c. Check refund status ───────────────────────────────────────
    const { data: refundTx } = await adminClient
      .from("credit_transactions")
      .select("id, amount, created_at, description")
      .eq("generation_id", generation.id)
      .eq("type", "admin_refund")
      .limit(1);

    const refunded = !!(refundTx && refundTx.length > 0);

    return Response.json({
      success: true,
      generation: {
        isTimeout,
        // existing fields follow
        id: generation.id,
        userId: generation.user_id,
        model: generation.model,
        prompt: generation.prompt,
        outputType: generation.output_type,
        status: generation.status,
        credits: generation.cost,
        taskId: generation.task_id,
        videoUrl: generation.video_url,
        coverUrl: generation.cover_url,
        error: generation.error,
        settings: generation.settings,
        chargedAt: generation.charged_at,
        createdAt: generation.created_at,
        updatedAt: generation.updated_at,
        refunded,
        refundTransaction: refunded && refundTx
          ? {
              id: refundTx[0].id,
              amount: refundTx[0].amount,
              createdAt: refundTx[0].created_at,
              description: refundTx[0].description,
            }
          : null,
      },
      user: profile
        ? {
            id: profile.id,
            email: profile.email ?? "",
            credits: profile.credits ?? 0,
          }
        : null,
      transactions: transactions ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/generations/[id]] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
