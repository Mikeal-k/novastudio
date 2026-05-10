import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type DbGeneration = {
  id: string;
  user_id: string;
  model: string | null;
  output_type: string | null;
  video_url: string | null;
  cover_url: string | null;
  created_at: string | null;
  public_title: string | null;
  public_description: string | null;
  public_category: string | null;
  published_at: string | null;
  likes_count: number | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
};

type LikeRow = {
  generation_id: string;
};

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes("@")) return "匿名用户";

  const [name, domain] = email.split("@");
  if (!name || !domain) return "匿名用户";

  if (name.length <= 4) {
    return `${name.slice(0, 1)}***@${domain}`;
  }

  return `${name.slice(0, 3)}****${name.slice(-2)}@${domain}`;
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminSupabaseClient();
    const searchParams = request.nextUrl.searchParams;

    const category = searchParams.get("category");
    const sort = searchParams.get("sort") === "likes" ? "likes" : "latest";

    let currentUserId: string | null = null;
    const authHeader = request.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const {
        data: { user },
      } = await adminClient.auth.getUser(token);

      currentUserId = user?.id ?? null;
    }

    let query = adminClient
      .from("generations")
      .select(
        [
          "id",
          "user_id",
          "model",
          "output_type",
          "video_url",
          "cover_url",
          "created_at",
          "public_title",
          "public_description",
          "public_category",
          "published_at",
          "likes_count",
        ].join(",")
      )
      .eq("is_public", true)
      .limit(50);

    if (category && category !== "全部") {
      query = query.eq("public_category", category);
    }

    if (sort === "likes") {
      query = query
        .order("likes_count", { ascending: false })
        .order("published_at", { ascending: false });
    } else {
      query = query.order("published_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/public-generations] Failed to fetch:", error);
      return Response.json(
        { success: false, error: "获取公开作品失败" },
        { status: 500 }
      );
    }

    const generations = (data ?? []) as unknown as DbGeneration[];
    const generationIds = generations.map((item) => item.id);
    const userIds = Array.from(new Set(generations.map((item) => item.user_id)));

    const profilesById = new Map<string, string | null>();

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await adminClient
        .from("profiles")
        .select("id,email")
        .in("id", userIds);

      if (profileError) {
        console.error("[api/public-generations] Failed to fetch profiles:", profileError);
      } else {
        ((profiles ?? []) as unknown as ProfileRow[]).forEach((profile) => {
          profilesById.set(profile.id, profile.email);
        });
      }
    }

    const likedGenerationIds = new Set<string>();

    if (currentUserId && generationIds.length > 0) {
      const { data: likes, error: likeError } = await adminClient
        .from("generation_likes")
        .select("generation_id")
        .eq("user_id", currentUserId)
        .in("generation_id", generationIds);

      if (likeError) {
        console.error("[api/public-generations] Failed to fetch likes:", likeError);
      } else {
        ((likes ?? []) as unknown as LikeRow[]).forEach((like) => {
          likedGenerationIds.add(like.generation_id);
        });
      }
    }

    return Response.json({
      success: true,
      generations: generations.map((item) => ({
        id: item.id,
        title: item.public_title || "未命名作品",
        description: item.public_description || "",
        category: item.public_category || "全部",
        modelId: item.model,
        outputType: item.output_type,
        videoUrl: item.video_url,
        coverUrl: item.cover_url,
        thumbnailUrl: item.cover_url || null,
        likesCount: item.likes_count ?? 0,
        publishedAt: item.published_at || item.created_at,
        userEmailMasked: maskEmail(profilesById.get(item.user_id)),
        isLikedByCurrentUser: likedGenerationIds.has(item.id),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    console.error("[api/public-generations] Error:", message);

    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}


