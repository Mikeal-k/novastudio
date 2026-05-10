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
        { success: false, error: "请先登录后点赞" },
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

    // Only allow liking public generations
    const { data: generation, error: fetchError } = await adminClient
      .from("generations")
      .select("id,is_public")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[api/public-generations/like] fetch error:", fetchError);

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

    if (!generation.is_public) {
      return Response.json(
        { success: false, error: "该作品尚未发布，无法点赞" },
        { status: 400 }
      );
    }

    // Check if the user already liked this generation
    const { data: existingLike } = await adminClient
      .from("generation_likes")
      .select("id")
      .eq("generation_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    let liked: boolean;

    if (existingLike) {
      // Unlike: remove the existing like
      const { error: deleteError } = await adminClient
        .from("generation_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) {
        console.error("[api/public-generations/like] delete error:", deleteError);

        return Response.json(
          { success: false, error: "取消点赞失败" },
          { status: 500 }
        );
      }

      liked = false;
    } else {
      // Like: insert a new like
      const { error: insertError } = await adminClient
        .from("generation_likes")
        .insert({
          generation_id: id,
          user_id: user.id,
        });

      if (insertError) {
        console.error("[api/public-generations/like] insert error:", insertError);

        return Response.json(
          { success: false, error: "点赞失败" },
          { status: 500 }
        );
      }

      liked = true;
    }

    // Re-count likes for this generation
    const { count, error: countError } = await adminClient
      .from("generation_likes")
      .select("*", { count: "exact", head: true })
      .eq("generation_id", id);

    if (countError) {
      console.error("[api/public-generations/like] count error:", countError);
    }

    const likesCount = count ?? 0;

    // Write the count back to generations.likes_count
    const { error: updateError } = await adminClient
      .from("generations")
      .update({ likes_count: likesCount })
      .eq("id", id);

    if (updateError) {
      console.error("[api/public-generations/like] update likes_count error:", updateError);
    }

    return Response.json({
      success: true,
      liked,
      likesCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error("[api/public-generations/like] error:", message);

    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
