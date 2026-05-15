import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/generations
 *
 * Returns a paginated list of all generation tasks for the admin panel.
 * Requires:
 *   - Valid Bearer token (logged-in user)
 *   - user.email === ADMIN_EMAIL
 *
 * Query params:
 *   q        - Search by user email or prompt (partial match, case-insensitive)
 *   model    - Filter by model (e.g. "gpt-image-1.5", "gpt-image-2", "seedance-2")
 *   status   - Filter by status (pending, running, succeeded, failed)
 *   page     - Page number (1-based, default 1)
 *   pageSize - Items per page (default 20, max 100)
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

    // ── 2. Parse query params ─────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    let model = searchParams.get("model") || "";
    let status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const offset = (page - 1) * pageSize;

    // ── 2b. Normalize status filter ───────────────────────────────────
    // "success" -> "succeeded" for backward compatibility
    if (status === "success") {
      status = "succeeded";
    }

    // ── 2c. Normalize model filter ────────────────────────────────────
    // Support both "Seedance 2.0" and "seedance-2" (and similar for GPT Image)
    const MODEL_ALIASES: Record<string, string> = {
      "seedance-2": "seedance-2",
      "Seedance 2.0": "seedance-2",
      "seedance 2.0": "seedance-2",
      "gpt-image-1.5": "gpt-image-1.5",
      "GPT Image 1.5": "gpt-image-1.5",
      "gpt image 1.5": "gpt-image-1.5",
      "gpt-image-2": "gpt-image-2",
      "GPT Image 2": "gpt-image-2",
      "gpt image 2": "gpt-image-2",
    };
    if (model && MODEL_ALIASES[model]) {
      model = MODEL_ALIASES[model];
    }

    // ── 3. Build queries ──────────────────────────────────────────────
    // We need to join generations with profiles to get user email.
    // Use a subquery approach: first get filtered generations, then enrich.

    let countQuery = adminClient
      .from("generations")
      .select("id", { count: "exact", head: true });

    let listQuery = adminClient
      .from("generations")
      .select("id, user_id, model, prompt, status, cost, task_id, video_url, cover_url, error, settings, charged_at, created_at, updated_at");

    // Apply filters
    if (model) {
      countQuery = countQuery.eq("model", model);
      listQuery = listQuery.eq("model", model);
    }

    if (status) {
      countQuery = countQuery.eq("status", status);
      listQuery = listQuery.eq("status", status);
    }

    // For text search (q), we search across generations.prompt
    // Email search requires a join, handled separately below
    if (q) {
      const likePattern = `%${q}%`;
      // Search prompt
      countQuery = countQuery.or(`prompt.ilike.${likePattern}`);
      listQuery = listQuery.or(`prompt.ilike.${likePattern}`);
    }

    listQuery = listQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const [countResult, listResult] = await Promise.allSettled([
      countQuery,
      listQuery,
    ]);

    const total =
      countResult.status === "fulfilled" ? countResult.value.count ?? 0 : 0;
    const generations =
      listResult.status === "fulfilled" ? listResult.value.data ?? [] : [];

    // ── 4. Enrich with user email ─────────────────────────────────────
    const userIds = generations.map((g) => g.user_id);
    const emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      if (profiles) {
        for (const p of profiles) {
          emailMap[p.id] = p.email ?? "";
        }
      }
    }

    // ── 4b. Compute timeout flag for image models ────────────────────
    const IMAGE_MODELS = new Set(["gpt-image-1.5", "gpt-image-2"]);
    const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

    function isImageTimeout(g: { model: string; status: string; created_at: string }): boolean {
      if (!IMAGE_MODELS.has(g.model)) return false;
      if (g.status !== "running" && g.status !== "pending") return false;
      const elapsed = Date.now() - new Date(g.created_at).getTime();
      return elapsed > TIMEOUT_MS;
    }

    // ── 4c. Check refund status for each generation ───────────────────
    // Query credit_transactions for admin_refund records linked to these generations
    const genIds = generations.map((g) => g.id);
    const refundedSet = new Set<string>();
    const refundDetails: Record<string, { amount: number; createdAt: string }> = {};

    if (genIds.length > 0) {
      const { data: refundTx } = await adminClient
        .from("credit_transactions")
        .select("generation_id, amount, created_at")
        .eq("type", "admin_refund")
        .in("generation_id", genIds);

      if (refundTx) {
        for (const tx of refundTx) {
          if (tx.generation_id) {
            refundedSet.add(tx.generation_id);
            refundDetails[tx.generation_id] = {
              amount: tx.amount,
              createdAt: tx.created_at,
            };
          }
        }
      }
    }

    // ── 5. If q search also targets email, filter again ───────────────
    let items = generations.map((g) => ({
      id: g.id,
      userId: g.user_id,
      userEmail: emailMap[g.user_id] || "",
      model: g.model,
      status: g.status,
      prompt: g.prompt,
      credits: g.cost,
      taskId: g.task_id,
      videoUrl: g.video_url,
      coverUrl: g.cover_url,
      error: g.error,
      settings: g.settings,
      chargedAt: g.charged_at,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
      refunded: refundedSet.has(g.id),
      refundAmount: refundDetails[g.id]?.amount ?? null,
      refundAt: refundDetails[g.id]?.createdAt ?? null,
      // Computed flag: image model stuck in running/pending for >3 minutes
      isTimeout: isImageTimeout(g),
    }));

    // If q is provided, also filter by email (post-query since we need the join)
    if (q) {
      const lowerQ = q.toLowerCase();
      items = items.filter(
        (item) =>
          item.userEmail.toLowerCase().includes(lowerQ) ||
          item.prompt.toLowerCase().includes(lowerQ)
      );
    }

    return Response.json({
      success: true,
      items,
      total: q ? items.length : total,
      page,
      pageSize,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/admin/generations] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
