import { NextRequest } from "next/server";
import { submitVideoGeneration } from "@/lib/seedance";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, aspectRatio, duration } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return Response.json(
        { success: false, error: "Prompt is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const result = await submitVideoGeneration({
      prompt: prompt.trim(),
      aspectRatio,
      duration,
    });

    return Response.json({
      success: true,
      taskId: result.id,
      provider: "seedance",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[generate-video] Error:", message);
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
