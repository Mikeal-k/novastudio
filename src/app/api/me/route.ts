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

    // Get or create profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Profile doesn't exist yet — create one with default 30 credits
      const { data: newProfile, error: insertError } = await adminClient
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          credits: 30,
        })
        .select("credits")
        .single();

      if (insertError || !newProfile) {
        console.error("[api/me] Failed to create profile:", insertError);
        return Response.json(
          { success: false, error: "创建用户资料失败" },
          { status: 500 }
        );
      }

      // Record signup bonus transaction
      await adminClient.from("credit_transactions").insert({
        user_id: user.id,
        type: "signup_bonus",
        amount: 30,
        balance_after: 30,
        description: "新用户注册赠送积分",
      });

      return Response.json({
        success: true,
        user: { id: user.id, email: user.email },
        profile: { credits: newProfile.credits },
      });
    }

    return Response.json({
      success: true,
      user: { id: user.id, email: user.email },
      profile: { credits: profile.credits },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/me] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
