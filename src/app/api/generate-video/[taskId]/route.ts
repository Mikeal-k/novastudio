import { NextRequest } from "next/server";
import { queryVideoTask } from "@/lib/seedance";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return Response.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const result = await queryVideoTask(taskId);

    switch (result.status) {
      case "pending":
      case "running":
        return Response.json({
          success: true,
          status: result.status,
        });

      case "succeeded":
        return Response.json({
          success: true,
          status: "succeeded",
          videoUrl: result.result?.video_url ?? null,
          coverUrl: result.result?.cover_url ?? null,
        });

      case "failed":
      case "canceled":
        return Response.json({
          success: true,
          status: "failed",
          error: result.error ?? "Video generation failed",
        });

      default:
        return Response.json({
          success: true,
          status: "running",
        });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[generate-video/query] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
