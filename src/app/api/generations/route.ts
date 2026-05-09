import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { success: false, error: "未提供认证令牌" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const adminClient = createAdminSupabaseClient();

    // Verify the user with the token
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

    // Fetch the most recent 10 generations for this user
    const { data: generations, error: genError } = await adminClient
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (genError) {
      console.error("[api/generations] Failed to fetch generations:", genError);
      return Response.json(
        { success: false, error: "获取生成记录失败" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      generations: generations ?? [],
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
