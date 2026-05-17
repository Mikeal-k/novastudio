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

import {
  MODEL_CREDIT_COSTS,
  SEEDANCE_DURATION_COST,
  SEEDANCE_DURATIONS,
} from "@/lib/pricing";

// Re-export for convenience
export { SEEDANCE_DURATION_COST, SEEDANCE_DURATIONS };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerationCostParams {
  /** Model identifier (e.g. "seedance-2", "gpt-image-1.5", "gpt-image-2") */
  modelId: string;
  /** Output type: "image" or "video" */
  outputType: "image" | "video";
  /** Video duration in seconds (only applies to video models) */
  duration?: number;
  /** Quality level: "标准", "高清", "超清" (only applies to video models) */
  quality?: string;
}

export interface SeedanceSubmitRequest {
  /** Text prompt describing the desired video */
  prompt: string;
  /** Aspect ratio: "1:1", "9:16", or "16:9" */
  aspectRatio?: string;
  /** Duration in seconds: 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, or 15 */
  duration?: number;
  /** Quality level: "标准", "高清", "超清" — used to determine resolution */
  quality?: string;
  /** Whether to generate audio (AI sound effects + background music) */
  generateAudio?: boolean;
  /** Enable AI sound effects (环境声、动作声、机械声等) */
  audioSfx?: boolean;
  /** Enable AI background music (原创背景音乐和氛围音乐) */
  audioMusic?: boolean;
  /** Data URL of a reference image for image-to-video generation (Seedance 2.0 only) */
  referenceImageDataUrl?: string;
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
 * Map our frontend quality/clarity value to Seedance API resolution.
 *
 * Mapping rules:
 *   "标准" (standard)  → "720p"
 *   "高清" (hd)        → "720p"
 *   "超清" (ultra)     → "1080p"
 *
 * Falls back to "720p" for unknown values.
 */
function mapResolution(quality?: string): string {
  if (quality === "超清") return "1080p";
  return "720p";
}

/**
 * Map our frontend duration (seconds) to Seedance API value.
 * Only the durations defined in SEEDANCE_DURATIONS are valid.
 * If the requested duration is not supported, use the nearest valid value.
 */
function mapDuration(duration: number): number {
  const valid = SEEDANCE_DURATIONS;
  if (valid.includes(duration)) return duration;
  // Find nearest valid duration
  const nearest = valid.reduce((prev, curr) =>
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
  );
  return nearest;
}

// ─── Generation Cost Calculation ────────────────────────────────────────────

/**
 * Base credit costs for image models.
 * For video models (Seedance), costs are directly mapped by duration.
 */
const MODEL_BASE_COST: Record<string, number> = {
  "gpt-image-1.5": MODEL_CREDIT_COSTS["gpt-image-1.5"],
  "gpt-image-2": MODEL_CREDIT_COSTS["gpt-image-2"],
  "nano-banana-pro": 8,
  "design": 10,
  "branding": 15,
  "ecommerce": 12,
  "seedance-2": 0, // Seedance uses direct duration map, not base cost
  "grok-imagine": 25,
  "video": 20,
};

/**
 * Duration multiplier for video generation using base cost formula.
 * This is only used for non-Seedance video models. Seedance uses direct cost map.
 */
const DURATION_MULTIPLIER: Record<number, number> = {
  4: 0.4,
  5: 0.6,
  7: 0.8,
  8: 0.9,
  9: 1,
  10: 1,
  11: 1.1,
  12: 1.2,
  13: 1.3,
  14: 1.4,
  15: 1.5,
};

/**
 * Quality multiplier for video generation.
 */
const QUALITY_MULTIPLIER: Record<string, number> = {
  "标准": 1,
  "高清": 1.5,
  "超清": 2,
};

/**
 * Calculate the credit cost for a generation request.
 *
 * For Seedance 2.0, costs are directly mapped by duration (no quality multiplier).
 * For image models, returns the base cost directly.
 * For other video models, applies duration and quality multipliers:
 *   Math.ceil(baseCost * durationMultiplier * qualityMultiplier)
 *
 * @example
 * getGenerationCost({ modelId: "seedance-2", outputType: "video", duration: 10 })
 * // => 93
 */
export function getGenerationCost(params: GenerationCostParams): number {
  const { modelId, outputType, duration, quality } = params;

  // Seedance 2.0: direct duration-based cost
  if (modelId === "seedance-2") {
    const dur = duration ?? 10;
    const cost = SEEDANCE_DURATION_COST[dur];
    if (cost !== undefined) return cost;
    // Fallback: find nearest valid duration
    const nearest = mapDuration(dur);
    return SEEDANCE_DURATION_COST[nearest] ?? 93;
  }

  const baseCost = MODEL_BASE_COST[modelId] ?? 0;

  // Image models: no duration/quality multipliers
  if (outputType === "image") {
    return baseCost;
  }

  // Video models (non-Seedance): apply multipliers
  const dur = duration ?? 10;
  const q = quality ?? "标准";

  const durMul = DURATION_MULTIPLIER[dur] ?? 1;
  const qMul = QUALITY_MULTIPLIER[q] ?? 1;

  return Math.ceil(baseCost * durMul * qMul);
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
  let prompt = request.prompt;

  // Enhance prompt with audio descriptions if audio features are enabled
  if (request.generateAudio || request.audioSfx || request.audioMusic) {
    if (request.audioSfx) {
      prompt += " 包含真实环境声、动作声、自然声或机械声，声音与画面同步。";
    }
    if (request.audioMusic) {
      prompt += " 包含原创背景音乐和氛围音乐，音乐风格自然，不引用任何现有歌曲。";
    }
  }

  const text = `${prompt} --ratio ${ratio} --fps 24 --dur ${durationSeconds}`;

  // Build content array — text prompt always first, optional image reference second
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text,
    },
  ];

  if (request.referenceImageDataUrl) {
    content.push({
      type: "image_url",
      image_url: {
        url: request.referenceImageDataUrl,
      },
    });
  }

  const resolution = mapResolution(request.quality);

  const body: Record<string, unknown> = {
    model,
    content,
    resolution,
  };

  // Add generate_audio flag when audio features are enabled
  if (request.generateAudio) {
    body.generate_audio = true;
  }

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
 * Helper: extract a string URL from a value that could be:
 * - A string (direct URL)
 * - An object with a `url` property: { url: "https://..." }
 * - null / undefined
 */
function extractUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url: unknown }).url;
    if (typeof url === "string" && url.length > 0) return url;
  }
  return undefined;
}

/**
 * Helper: extract video_url and cover_url from the Seedance API response's
 * `content` field, which may be EITHER:
 *
 *   Object format:
 *     { "video_url": "...", "cover_url": "..." }
 *
 *   Array format (Volcengine Ark standard):
 *     [
 *       { "content_type": "video", "video_url": { "url": "...", "url_expire_at": 123 } },
 *       { "content_type": "video", "video_url": "..." }
 *     ]
 *
 *   Or any nested variation thereof.
 */
function extractContentUrls(
  content: unknown
): { video_url?: string; cover_url?: string } {
  const result: { video_url?: string; cover_url?: string } = {};

  if (!content) return result;

  // Case 1: content is a plain object with video_url / cover_url keys
  if (!Array.isArray(content) && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    const vu = extractUrl(obj.video_url);
    if (vu) result.video_url = vu;
    const cu = extractUrl(obj.cover_url);
    if (cu) result.cover_url = cu;
    return result;
  }

  // Case 2: content is an array — iterate items and find video / cover
  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const contentType =
        String(obj.content_type ?? obj.type ?? "").toLowerCase();

      // If this item is a "video" type, try to extract video_url
      if (contentType === "video") {
        const vu = extractUrl(obj.video_url ?? obj.url);
        if (vu && !result.video_url) result.video_url = vu;
        const cu = extractUrl(obj.cover_url);
        if (cu && !result.cover_url) result.cover_url = cu;
      }

      // Also check top-level item keys as a fallback
      if (!result.video_url) {
        const vu = extractUrl(obj.video_url ?? obj.url);
        if (vu) result.video_url = vu;
      }
      if (!result.cover_url) {
        const cu = extractUrl(obj.cover_url);
        if (cu) result.cover_url = cu;
      }
    }
    return result;
  }

  return result;
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
 *     "content": { "video_url": "..." } | [ { "content_type": "video", "video_url": ... } ]
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

  // Extract video/cover URLs from content (handles both object and array formats)
  const urls = extractContentUrls(data.content);
  console.log(
    `[seedance] Extracted URLs -> video_url=${urls.video_url ?? "(none)"} cover_url=${urls.cover_url ?? "(none)"}`
  );

  const result: SeedanceTaskResult = {
    video_url: urls.video_url,
    cover_url: urls.cover_url,
  };

  return {
    status,
    result: status === "succeeded" ? result : undefined,
    error: data.error ?? undefined,
  };
}
