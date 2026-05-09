import { NextRequest } from "next/server";
import { submitVideoGeneration, getGenerationCost } from "@/lib/seedance";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────
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

    // ── Parse request body ──────────────────────────────────────────────
    const body = await request.json();
    const { prompt, aspectRatio, duration, quality, style } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return Response.json(
        { success: false, error: "Prompt is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // ── Calculate cost server-side (don't trust client) ─────────────────
    const calculatedCost = getGenerationCost({
      modelId: "seedance-2",
      outputType: "video",
      duration: duration ?? 10,
      quality: quality ?? "标准",
    });

    // ── Check credits ───────────────────────────────────────────────────
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return Response.json(
        { success: false, error: "获取用户资料失败" },
        { status: 500 }
      );
    }

    if (profile.credits < calculatedCost) {
      return Response.json(
        {
          success: false,
          error: `真实视频生成成本较高，本次需要 ${calculatedCost} 积分。请先购买积分后再生成。`,
        },
        { status: 403 }
      );
    }

    // ── Create generation record (status: running) ──────────────────────
    const { data: generation, error: genError } = await adminClient
      .from("generations")
      .insert({
        user_id: user.id,
        model: "Seedance 2.0",
        prompt: prompt.trim(),
        output_type: "video",
        status: "running",
        cost: calculatedCost,
        settings: {
          aspectRatio: aspectRatio ?? "16:9",
          duration: duration ?? 10,
          quality: quality ?? "标准",
          style: style ?? "真实质感",
        },
      })
      .select("id")
      .single();

    if (genError || !generation) {
      console.error("[generate-video] Failed to create generation record:", genError);
      return Response.json(
        { success: false, error: "创建生成记录失败" },
        { status: 500 }
      );
    }

    // ── Submit to Seedance API ──────────────────────────────────────────
    const result = await submitVideoGeneration({
      prompt: prompt.trim(),
      aspectRatio,
      duration,
    });

    // ── Update generation record with task_id ───────────────────────────
    const { error: updateError } = await adminClient
      .from("generations")
      .update({ task_id: result.id })
      .eq("id", generation.id);

    if (updateError) {
      console.error("[generate-video] Failed to update task_id:", updateError);
    }

    return Response.json({
      success: true,
      taskId: result.id,
      generationId: generation.id,
      provider: "seedance",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[generate-video] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
