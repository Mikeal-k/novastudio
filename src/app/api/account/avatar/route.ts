import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json(
        { success: false, error: "请选择要上传的头像图片" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { success: false, error: "仅支持 PNG/JPG/WebP 格式的头像图片" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return Response.json(
        { success: false, error: "头像图片不能超过 2MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
    const filename = `avatar-${user.id.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const relativePath = `/generated/avatars/${filename}`;
    const absolutePath = join(process.cwd(), "public", relativePath);

    // Ensure directory exists
    await mkdir(join(process.cwd(), "public", "generated", "avatars"), { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    // Update user_metadata
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          avatar_url: relativePath,
        },
      }
    );

    if (updateError) {
      console.error("[api/account/avatar] Failed to update user metadata:", updateError);
      return Response.json(
        { success: false, error: "保存头像信息失败" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      avatarUrl: relativePath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/account/avatar] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
