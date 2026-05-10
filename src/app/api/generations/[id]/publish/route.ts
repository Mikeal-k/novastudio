import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return Response.json(
        { success: false, error: "缺少作品 ID" },
        { status: 400 }
      );
    }

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

    const body = await request.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "全部").trim() || "全部";

    if (!title) {
      return Response.json(
        { success: false, error: "请填写作品标题" },
        { status: 400 }
      );
    }

    const { data: generation, error: fetchError } = await adminClient
      .from("generations")
      .select("id,user_id,status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[api/generations/publish] fetch error:", fetchError);

      return Response.json(
        { success: false, error: "查询作品失败" },
        { status: 500 }
      );
    }

    if (!generation) {
      return Response.json(
        { success: false, error: "作品不存在" },
        { status: 404 }
      );
    }

    if (generation.user_id !== user.id) {
      return Response.json(
        { success: false, error: "只能发布自己的作品" },
        { status: 403 }
      );
    }

    if (generation.status !== "succeeded") {
      return Response.json(
        { success: false, error: "只有生成成功的作品可以发布" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await adminClient
      .from("generations")
      .update({
        is_public: true,
        public_title: title,
        public_description: description,
        public_category: category,
        published_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[api/generations/publish] update error:", updateError);

      return Response.json(
        { success: false, error: "发布作品失败" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      generation: updated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error("[api/generations/publish] error:", message);

    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
