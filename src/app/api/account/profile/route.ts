import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { displayName } = body;

    if (typeof displayName !== "string" || displayName.trim().length === 0) {
      return Response.json(
        { success: false, error: "昵称不能为空" },
        { status: 400 }
      );
    }

    const trimmedName = displayName.trim();

    if (trimmedName.length > 50) {
      return Response.json(
        { success: false, error: "昵称不能超过 50 个字符" },
        { status: 400 }
      );
    }

    // Update user_metadata
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          display_name: trimmedName,
        },
      }
    );

    if (updateError) {
      console.error("[api/account/profile] Failed to update user metadata:", updateError);
      return Response.json(
        { success: false, error: "保存昵称失败" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      displayName: trimmedName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/account/profile] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
