/**
 * Prompt optimizer for image generation models.
 *
 * Uses rule-based compression to reduce long, complex prompts into shorter,
 * more stable versions before sending to OpenAI's Images API.
 * This reduces the risk of timeout / failure for long storyboard-style prompts.
 *
 * No external API calls are made — pure string processing.
 */

// ─── Storyboard keywords (Chinese + English) ────────────────────────────────

const STORYBOARD_KEYWORDS = [
  "storyboard",
  "story board",
  "分镜",
  "分镜头",
  "故事版",
  "故事板",
  "6 panels",
  "six panels",
  "2x3",
  "3x2",
  "六格",
  "六宫格",
  "multi-panel",
];

function containsStoryboardKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return STORYBOARD_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Style / genre keywords (for storyboard template injection) ─────────────

const STYLE_KEYWORDS: [string, string][] = [
  ["fantasy", "fantasy"],
  ["奇幻", "fantasy"],
  ["sci-fi", "sci-fi"],
  ["科幻", "sci-fi"],
  ["cyberpunk", "cyberpunk"],
  ["赛博朋克", "cyberpunk"],
  ["horror", "horror"],
  ["恐怖", "horror"],
  ["anime", "anime"],
  ["动漫", "anime"],
  ["cartoon", "cartoon"],
  ["卡通", "cartoon"],
  ["realistic", "realistic"],
  ["写实", "realistic"],
  ["cinematic", "cinematic"],
  ["电影感", "cinematic"],
  ["dark", "dark"],
  ["黑暗", "dark"],
  ["epic", "epic"],
  ["史诗", "epic"],
];

function detectGenre(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, genre] of STYLE_KEYWORDS) {
    if (lower.includes(kw)) return genre;
  }
  return "epic cinematic";
}

// ─── Mixed-length estimation ────────────────────────────────────────────────
// For Chinese text, each character counts as ~1 "word".
// For English text, split by whitespace and count tokens.

function estimateMixedLength(text: string): number {
  const chineseChars = (
    text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []
  ).length;
  const nonChinese = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, " ")
    .trim();
  const englishTokens = nonChinese
    ? nonChinese.split(/\s+/).filter(Boolean).length
    : 0;
  return chineseChars + englishTokens;
}

// ─── Negative / constraint pattern ──────────────────────────────────────────

const NEGATIVE_RE = /(?:不(?:要|允许|包含|出现|要有|包括|能出现|希望有|添加)|没有|避免|请勿|切勿|禁止|no\s+|avoid\s+|without\s+|excluding\s+|do\s+not\s+|don'?t\s+)/i;

function isNegativeLine(line: string): boolean {
  return NEGATIVE_RE.test(line.trim());
}

// ─── Explanatory / meta sentence detection ──────────────────────────────────
// These are sentences that instruct the model rather than describe the image.

const META_PATTERNS = [
  /请注意/i,
  /please note/i,
  /意思是/i,
  /也就是说/i,
  /你可以/i,
  /you can/i,
  /you should/i,
  /we need/i,
  /这个提示/i,
  /this prompt/i,
  /参考/i,
  /refer to/i,
  /例如/i,
  /for example/i,
  /具体来说/i,
  /specifically/i,
  /换句话说/i,
  /first(?:ly)?[,: ]/i,
  /second(?:ly)?[,: ]/i,
  /third(?:ly)?[,: ]/i,
  /接下来/i,
  /步骤/i,
  /step/i,
  /提示词/i,
  /generat(?:e|ing) an image/i,
  /i want you to/i,
  /请生成/i,
  /请创建/i,
  /请根据/i,
  /请按照/i,
];

function isMetaSentence(sentence: string): boolean {
  const s = sentence.trim();
  // Only apply to longer sentences (>80 chars) to avoid false positives
  if (s.length < 80) return false;
  return META_PATTERNS.some((p) => p.test(s));
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract core visual description content (non-negative, non-meta lines). */
function extractCoreLines(text: string): string[] {
  const lines = text.split("\n");
  return lines.filter((line) => {
    const t = line.trim();
    if (!t) return false;
    if (isNegativeLine(t)) return false;
    if (isMetaSentence(t)) return false;
    return true;
  });
}

/** Extract a short theme line (~100 chars) from the user's original prompt. */
function extractThemeLine(rawText: string): string | null {
  const lines = rawText.split("\n");
  const positiveLines = lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (isNegativeLine(t)) return false;
    if (isMetaSentence(t)) return false;
    return true;
  });

  if (positiveLines.length === 0) return null;

  // Join positive lines and clean whitespace
  const text = positiveLines.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 20) return null;

  // Take first ~100 chars as concise theme description
  return text.length > 100 ? text.slice(0, 97) + "..." : text;
}

// ─── Negative constraint merging ────────────────────────────────────────────

function extractAndMergeNegatives(rawPrompt: string): string | null {
  const lines = rawPrompt.split("\n");
  const negativeSentences: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t && isNegativeLine(t)) {
      negativeSentences.push(t);
    }
  }

  if (negativeSentences.length === 0) return null;

  // Collect unique items from all negative lines
  const allItems: string[] = [];
  for (const sentence of negativeSentences) {
    // Strip the negative prefix
    const cleaned = sentence
      .replace(
        /^(?:不(?:要(?:有|包含|出现|包括|添加)?|允许|能出现|希望有)|没有|避免|请勿|切勿|禁止|no\s+|avoid\s+|without\s+|excluding\s+|do\s+not\s+|don'?t\s+)/i,
        "",
      )
      .trim();
    // Split by common delimiters
    const parts = cleaned
      .split(/[,，、/;；。.]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const normalized = part.replace(/^[和与及&]/, "").trim().toLowerCase();
      if (normalized && !allItems.includes(normalized)) {
        allItems.push(normalized);
      }
    }
  }

  if (allItems.length === 0) return null;

  // Cap at a reasonable number
  const items = allItems.slice(0, 12);

  // Capitalize first item properly
  const firstItem =
    items[0].charAt(0).toUpperCase() + items[0].slice(1);
  const rest = items.slice(1);

  return `Avoid ${firstItem}${rest.length > 0 ? ", " + rest.join(", ") : ""}.`;
}

// ─── Storyboard template (GPT Image 1.5 only) ──────────────────────────────

function buildStoryboardPrompt(coreContent: string, genre: string): string {
  const template = `Create an epic cinematic ${genre} storyboard concept board in 16:9. The image is divided into 6 panels in a clean 2x3 grid. Each panel shows a different cinematic shot from the same story. No text, no logo, no watermark.`;

  // If core content is too long, truncate it
  const maxCoreLen = 600;
  const core =
    coreContent.length > maxCoreLen
      ? coreContent.slice(0, maxCoreLen - 3) + "..."
      : coreContent;

  return `${template}\n\nKey elements: ${core}`;
}

// ─── GPT Image 2 storyboard template (ultra-compact: 350-500 chars) ───────

function buildGptImage2StoryboardPrompt(
  coreContent: string,
  genre: string,
  rawText: string,
): string {
  // Try to extract a short theme from the user's own original prompt
  const themeLine = extractThemeLine(rawText);

  // Base prefix — no hardcoded sacred tree / travelers / plateau
  // Padded so minimum output is ~380 chars, ensuring all paths land in 350-500 range.
  // Avoid "Epic epic cinematic" duplication when genre defaults to "epic cinematic"
  const genreTag = genre === "epic cinematic" ? "fantasy" : genre;
  const prefix = `Epic ${genreTag} storyboard concept art, 16:9, 6 panels in a clean 2x3 grid. Each panel shows a different cinematic moment from the same story. Cinematic widescreen composition, dynamic camera angles, rich color grading. Strong scale, dramatic lighting, deep perspective, atmospheric detail, high-end movie concept art. Moody atmosphere, epic scope.`;
  const negative = ` No text, logo, watermark.`;

  if (themeLine) {
    // Inject user's actual theme — total targets 350-500 chars
    // Output: prefix + " Theme: " + theme + "." + negative
    //         = baseLen + 9 (wrapping chars) + theme.length
    const baseLen = prefix.length + negative.length;
    const maxThemeLen = 500 - baseLen - 9; // 9 = " Theme: " (8) + "." (1)
    const theme =
      themeLine.length > maxThemeLen && maxThemeLen > 20
        ? themeLine.slice(0, maxThemeLen - 3) + "..."
        : themeLine;
    return prefix + ` Theme: ${theme}.` + negative;
  }

  // Generic fallback — no hardcoded sacred tree / travelers / plateau
  // Uses the same base template, ensuring consistent structure
  return `${prefix}${negative}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface OptimizeResult {
  optimized: string;
  enabled: boolean;
  rawLength: number;
  optimizedLength: number;
}

/**
 * Optimize an image generation prompt for stability.
 *
 * Rules:
 * 1. Only affects `gpt-image-1.5` and `gpt-image-2` models
 * 2. Triggers when raw prompt > 800 chars OR mixed length > 500 tokens
 * 3. Detects storyboard prompts and applies compact template
 * 4. GPT Image 1.5: standard storyboard template (~1200 chars)
 * 5. GPT Image 2: ultra-compact storyboard template (350-500 chars)
 * 6. Merges duplicate negative constraints into one line
 * 7. Removes meta-instruction / explanatory sentences
 * 8. Collapses excessive blank lines
 * 9. Returns original unchanged if already short enough
 *
 * @param rawPrompt - The user's original prompt
 * @param modelId - The model identifier (e.g. "gpt-image-2", "seedance-2")
 * @returns OptimizeResult with the optimized prompt and metadata
 */
export function optimizeImagePrompt(
  rawPrompt: string,
  modelId: string,
): OptimizeResult {
  const trimmed = rawPrompt.trim();
  const rawLength = trimmed.length;

  // ── Step 1: Only for GPT Image models ──
  const isImageModel =
    modelId === "gpt-image-1.5" || modelId === "gpt-image-2";
  if (!isImageModel) {
    return {
      optimized: trimmed,
      enabled: false,
      rawLength,
      optimizedLength: rawLength,
    };
  }

  // ── Step 2: Check if prompt is long enough to need optimization ──
  const mixedLength = estimateMixedLength(trimmed);
  const needsOptimization = rawLength > 800 || mixedLength > 500;

  if (!needsOptimization) {
    return {
      optimized: trimmed,
      enabled: false,
      rawLength,
      optimizedLength: rawLength,
    };
  }

  // ── Step 3: Collapse blank lines ──
  const processed = collapseBlankLines(trimmed);

  // ── Step 4: Detect storyboard ──
  const isStoryboard = containsStoryboardKeywords(processed);

  let optimized: string;

  if (isStoryboard) {
    // Extract core visual description (non-negative, non-meta)
    const coreLines = extractCoreLines(processed);
    const coreContent = coreLines.join(" ").replace(/\s+/g, " ").trim();

    // Detect genre from user prompt
    const genre = detectGenre(processed);

    if (modelId === "gpt-image-2") {
      // GPT Image 2: ultra-compact storyboard template (350-500 chars)
      // Long prompts cause timeout on complex 16:9 storyboard generations
      // Pass original raw text so extractThemeLine can pull user's actual theme
      optimized = buildGptImage2StoryboardPrompt(coreContent, genre, trimmed);
    } else {
      // GPT Image 1.5: standard storyboard template (~1200 chars)
      // Merge and append negative constraints
      const negatives = extractAndMergeNegatives(processed);
      optimized = buildStoryboardPrompt(coreContent, genre);
      if (negatives) {
        optimized += `\n\n${negatives}`;
      }
    }
  } else {
    // Non-storyboard: general cleanup
    const coreLines = extractCoreLines(processed);
    let coreText = coreLines.join(" ").replace(/\s+/g, " ").trim();

    // Merge negative constraints
    const negatives = extractAndMergeNegatives(processed);

    // Build final prompt: core description + (optionally) merged negatives
    if (negatives) {
      // Cap core text to leave room for negatives
      if (coreText.length > 900) {
        coreText = coreText.slice(0, 897) + "...";
      }
      optimized = `${coreText}\n\n${negatives}`;
    } else {
      // No negatives, just use core text capped
      if (coreText.length > 1100) {
        coreText = coreText.slice(0, 1097) + "...";
      }
      optimized = coreText;
    }
  }

  // ── Step 5: Final cap at ~1300 chars (safety margin) ──
  if (optimized.length > 1300) {
    optimized = optimized.slice(0, 1297) + "...";
  }

  // ── Step 6: Final cleanup ──
  optimized = optimized.replace(/\n{3,}/g, "\n\n").trim();

  return {
    optimized,
    enabled: true,
    rawLength,
    optimizedLength: optimized.length,
  };
}
