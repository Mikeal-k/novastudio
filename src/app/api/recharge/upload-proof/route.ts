import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// ─── Allowed MIME types ──────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Helper: extract file extension from MIME type ───────────────────────────

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

// ─── POST /api/recharge/upload-proof ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate user ───────────────────────────────────────────
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

    // ── 2. Parse FormData ──────────────────────────────────────────────
    const formData = await request.formData();
    const orderId = formData.get("orderId") as string | null;
    const file = formData.get("file") as File | null;
    const payerNote = (formData.get("payerNote") as string | null) ?? "";

    if (!orderId || !file) {
      return Response.json(
        { success: false, error: "缺少必要参数：orderId 和 file" },
        { status: 400 }
      );
    }

    // ── 3. Validate file type ──────────────────────────────────────────
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        {
          success: false,
          error: "不支持的文件类型，仅支持 PNG、JPEG、WebP 格式",
        },
        { status: 400 }
      );
    }

    // ── 4. Validate file size ──────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          success: false,
          error: "文件大小超过限制（最大 5MB）",
        },
        { status: 400 }
      );
    }

    // ── 5. Validate order belongs to current user and is pending ───────
    const { data: order, error: orderError } = await adminClient
      .from("recharge_orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return Response.json(
        { success: false, error: "订单不存在" },
        { status: 404 }
      );
    }

    if (order.user_id !== user.id) {
      return Response.json(
        { success: false, error: "无权操作此订单" },
        { status: 403 }
      );
    }

    if (order.status !== "pending") {
      return Response.json(
        { success: false, error: "订单状态不是待付款，无法上传付款截图" },
        { status: 400 }
      );
    }

    // ── 6. Upload file to Supabase Storage ─────────────────────────────
    const ext = getExtension(file.type);
    const timestamp = Date.now();
    const storagePath = `${user.id}/${orderId}-${timestamp}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("recharge-proofs")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[api/recharge/upload-proof] Upload error:", uploadError);
      return Response.json(
        { success: false, error: "上传付款截图失败，请重试" },
        { status: 500 }
      );
    }

    // ── 7. Get public URL ──────────────────────────────────────────────
    const { data: publicUrlData } = adminClient.storage
      .from("recharge-proofs")
      .getPublicUrl(storagePath);

    const proofUrl = publicUrlData?.publicUrl ?? "";

    if (!proofUrl) {
      console.error("[api/recharge/upload-proof] Failed to get public URL");
      return Response.json(
        { success: false, error: "获取图片访问地址失败" },
        { status: 500 }
      );
    }

    // ── 8. Update recharge_orders ──────────────────────────────────────
    const { error: updateError } = await adminClient
      .from("recharge_orders")
      .update({
        payment_proof_url: proofUrl,
        payment_proof_uploaded_at: new Date().toISOString(),
        payer_note: payerNote || null,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(
        "[api/recharge/upload-proof] Update order error:",
        updateError
      );
      // File already uploaded — log error but don't fail entirely
      console.error(
        "[api/recharge/upload-proof] File uploaded but order update failed"
      );
    }

    return Response.json({
      success: true,
      proofUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[api/recharge/upload-proof] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
