/**
 * Seedance 2.0 API service
 *
 * Wraps the Volcengine Ark (火山方舟) Seedance 2.0 video generation API.
 * Uses the asynchronous task pattern:
 *   1. POST {ARK_BASE_URL}/contents/generations/tasks  — create a video generation task
 *   2. GET  {ARK_BASE_URL}/contents/generations/tasks/{taskId} — poll for task status
 *
 * Environment variables:
 *   ARK_API_KEY     — API key for authentication
 *   ARK_BASE_URL    — Base URL (e.g. https://ark.cn-beijing.volces.com/api/v3)
 *   SEEDANCE_MODEL  — Model identifier (e.g. doubao-seedance-2-0-260128)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeedanceSubmitRequest {
  /** Text prompt describing the desired video */
  prompt: string;
  /** Aspect ratio: "1:1", "9:16", or "16:9" */
  aspectRatio?: string;
  /** Duration in seconds: 5, 10, 15, or 30 */
  duration?: number;
}

export interface SeedanceSubmitResponse {
  /** Unique task ID assigned by the API */
  id: string;
}

export type SeedanceTaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface SeedanceTaskResult {
  /** Video download URL (available when succeeded) */
  video_url?: string;
  /** Cover image URL (available when succeeded) */
  cover_url?: string;
}

export interface SeedanceQueryResponse {
  /** Current task status */
  status: SeedanceTaskStatus;
  /** Task result (present when succeeded) */
  result?: SeedanceTaskResult;
  /** Error message (present when failed) */
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = process.env.ARK_BASE_URL;
  if (!url) {
    throw new Error("Missing ARK_BASE_URL environment variable");
  }
  return url.replace(/\/+$/, "");
}

function getApiKey(): string {
  const key = process.env.ARK_API_KEY;
  if (!key) {
    throw new Error("Missing ARK_API_KEY environment variable");
  }
  return key;
}

function getModel(): string {
  const model = process.env.SEEDANCE_MODEL;
  if (!model) {
    throw new Error("Missing SEEDANCE_MODEL environment variable");
  }
  return model;
}

function buildHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  };
}

/**
 * Map our frontend aspect ratio to Seedance API value.
 * Seedance 2.0 supports: "1:1", "9:16", "16:9"
 */
function mapAspectRatio(ratio: string): string {
  const valid = ["1:1", "9:16", "16:9"];
  if (valid.includes(ratio)) return ratio;
  // Default to 16:9 if unknown
  return "16:9";
}

/**
 * Map our frontend duration (seconds) to Seedance API value.
 * Seedance 2.0 supports durations in seconds.
 * If the requested duration is not supported, use the nearest valid value.
 */
function mapDuration(duration: number): number {
  const valid = [5, 10, 15, 30];
  if (valid.includes(duration)) return duration;
  // Find nearest valid duration
  const nearest = valid.reduce((prev, curr) =>
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
  );
  return nearest;
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Submit a text-to-video generation task to Seedance 2.0 via Volcengine Ark API.
 *
 * POST {ARK_BASE_URL}/contents/generations/tasks
 *
 * Request body (JSON):
 *   {
 *     "model": "<model_name>",
 *     "content": [
 *       {
 *         "type": "text",
 *         "text": "<prompt> --ratio <ratio> --fps 24 --dur <duration>"
 *       }
 *     ]
 *   }
 *
 * Response (JSON):
 *   {
 *     "id": "cgt-xxxx"
 *   }
 */
export async function submitVideoGeneration(
  request: SeedanceSubmitRequest
): Promise<SeedanceSubmitResponse> {
  const baseUrl = getBaseUrl();
  const model = getModel();
  const ratio = request.aspectRatio
    ? mapAspectRatio(request.aspectRatio)
    : "16:9";
  const durationSeconds = request.duration
    ? mapDuration(request.duration)
    : 10;

  // Build the text prompt with parameters appended
  const text = `${request.prompt} --ratio ${ratio} --fps 24 --dur ${durationSeconds}`;

  const body = {
    model,
    content: [
      {
        type: "text",
        text,
      },
    ],
  };

  const url = `${baseUrl}/contents/generations/tasks`;
  console.log(`[seedance] POST ${url}`);
  console.log(`[seedance] Request body:`, JSON.stringify(body));

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[seedance] Submit failed (${response.status}): ${errorText}`
    );
    throw new Error(
      `Seedance API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  console.log(`[seedance] Submit response:`, JSON.stringify(data));

  if (!data.id) {
    console.error(
      `[seedance] No "id" in submit response. Full response:`,
      JSON.stringify(data)
    );
    throw new Error(
      `Seedance API error: response missing "id" field. Full response: ${JSON.stringify(data)}`
    );
  }

  return { id: data.id };
}

/**
 * Query the status of a video generation task.
 *
 * GET {ARK_BASE_URL}/contents/generations/tasks/{taskId}
 *
 * Response (JSON):
 *   {
 *     "model": "...",
 *     "status": "running" | "succeeded" | "failed" | ...,
 *     "content": {
 *       "video_url": "..."
 *     }
 *   }
 */
export async function queryVideoTask(
  taskId: string
): Promise<SeedanceQueryResponse> {
  const baseUrl = getBaseUrl();

  const url = `${baseUrl}/contents/generations/tasks/${taskId}`;
  console.log(`[seedance] GET ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[seedance] Query failed (${response.status}): ${errorText}`
    );
    throw new Error(
      `Seedance query API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  console.log(`[seedance] Query response:`, JSON.stringify(data));

  // Map Ark API status to our internal status
  let status: SeedanceTaskStatus;
  switch (data.status) {
    case "succeeded":
      status = "succeeded";
      break;
    case "failed":
      status = "failed";
      break;
    case "canceled":
      status = "canceled";
      break;
    case "running":
      status = "running";
      break;
    default:
      // "pending", "queued", or any other status → pending
      status = "pending";
      break;
  }

  // Build result object from response.content
  const result: SeedanceTaskResult = {
    video_url: data.content?.video_url ?? undefined,
    cover_url: data.content?.cover_url ?? undefined,
  };

  return {
    status,
    result: status === "succeeded" ? result : undefined,
    error: data.error ?? undefined,
  };
}
