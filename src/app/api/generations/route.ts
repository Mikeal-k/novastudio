import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { success: false, error: "请先登录" },
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
        { success: false, error: "登录状态已失效，请重新登录" },
        { status: 401 }
      );
    }

    const { data: generations, error: genError } = await adminClient
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (genError) {
      console.error("[api/generations] Failed to fetch generations:", genError);

      return Response.json(
        { success: false, error: "获取生成记录失败" },
        { status: 500 }
      );
    }

    const rows = generations ?? [];

    return Response.json({
      success: true,
      generations: rows.map((item) => ({
        ...item,

        // camelCase fields for the next UI step
        taskId: item.task_id ?? null,
        isPublic: item.is_public ?? false,
        publicTitle: item.public_title ?? null,
        publicDescription: item.public_description ?? null,
        publicCategory: item.public_category ?? null,
        publishedAt: item.published_at ?? null,
        likesCount: item.likes_count ?? 0,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error("[api/generations] Error:", message);

    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
