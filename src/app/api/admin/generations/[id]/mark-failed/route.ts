import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/generations/[id]/mark-failed
 *
 * Manually marks a generation task as failed by an admin.
 *
 * Body:
 *   { reason: string }
 *
 * Rules:
 *   - Updates status to "failed"
 *   - Writes the admin reason to error field
 *   - Does NOT auto-refund — refund must be done via the separate refund API
 *   - If charged_at is empty, no credit deduction occurred so no refund is needed
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

    // ── 2. Parse body ─────────────────────────────────────────────────
    const body = await _request.json();
    const reason = (body.reason ?? "").trim();

    if (!reason) {
      return Response.json(
        { success: false, error: "请填写标记失败的原因" },
        { status: 400 }
      );
    }

    // ── 3. Parse params and fetch generation ──────────────────────────
    const { id } = await params;

    if (!id) {
      return Response.json(
        { success: false, error: "缺少生成任务 ID" },
        { status: 400 }
      );
    }

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

    // ── 4. Update to failed ──────────────────────────────────────────
    // Prepend admin mark prefix to distinguish from system errors
    const errorMessage = `[管理员标记失败] ${reason}`;

    await adminClient
      .from("generations")
      .update({
        status: "failed",
        error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generation.id);

    return Response.json({
      success: true,
      message: "任务已标记为失败",
      error: errorMessage,
      hadCharged: !!generation.charged_at,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[admin/generations/mark-failed] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
