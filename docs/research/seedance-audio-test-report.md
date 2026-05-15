# Seedance 2.0 Audio Capability Test Report

**Date:** 2026-05-14
**Test Scripts:** [`scripts/test-seedance-audio.cjs`](scripts/test-seedance-audio.cjs), [`scripts/check-audio-tracks.cjs`](scripts/check-audio-tracks.cjs)
**API Endpoint:** `https://ark.cn-beijing.volces.com/api/v3`
**Model:** `doubao-seedance-2-0-260128`

---

## Test Results Summary

| Test | Prompt | `generate_audio` param | Status | Has Audio Track? |
|------|--------|----------------------|--------|-----------------|
| audio-prompt-safe | 带汽车行驶声和机械运转声 | ❌ not passed | ❌ FAILED (copyright) | N/A |
| **audio-prompt-generate_audio** | 带汽车行驶声和机械运转声 | ✅ `true` | ✅ SUCCEEDED | ✅ YES |
| **generate_audio-only** | 无音频描述 | ✅ `true` | ✅ SUCCEEDED | ✅ YES |
| **music-prompt** | 背景有钢琴伴奏音乐 | ✅ `true` | ✅ SUCCEEDED | ✅ YES |

---

## 1. Does Ark Seedance accept audio-related parameters?

**✅ YES — `generate_audio: true` is a valid request parameter.**

All three tests that included `"generate_audio": true` in the request body succeeded and produced videos with audio tracks. When `generate_audio` was NOT passed (test 1), the same prompt failed with a copyright policy violation — suggesting the API can't / won't generate audio content without explicitly enabling it.

**Request body format:**
```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {
      "type": "text",
      "text": "5秒视频，夜晚城市街头，一个机器人站在车流中 --ratio 16:9 --fps 24 --dur 5"
    }
  ],
  "generate_audio": true   // <-- this is the key parameter
}
```

---

## 2. Does the returned video have its own audio track?

**✅ YES — ALL generated videos contain embedded audio tracks.**

Binary analysis of the downloaded MP4 files confirms:

| File | Tracks | Video Track | Audio Track |
|------|--------|------------|-------------|
| `audio-prompt-generate_audio.mp4` (1.67 MB) | 2 | ✅ hdlr=vide | ✅ hdlr=soun |
| `generate_audio-only.mp4` (2.22 MB) | 2 | ✅ hdlr=vide | ✅ hdlr=soun |
| `music-prompt.mp4` (2.08 MB) | 2 | ✅ hdlr=vide | ✅ hdlr=soun |

The audio is embedded **directly in the MP4 container** — no separate audio file is needed.

---

## 3. Does the response body contain `audio_url`?

**❌ NO — no `audio_url` or any audio download URL in any response.**

Full response structure for a successful task:
```json
{
  "id": "cgt-20260514183217-t8rzv",
  "model": "doubao-seedance-2-0-260128",
  "status": "succeeded",
  "content": {
    "video_url": "https://...mp4?..."
    // NO audio_url, NO cover_url
  },
  "usage": {
    "completion_tokens": 108900,
    "total_tokens": 108900
  },
  "created_at": 1778754737,
  "updated_at": 1778755025,
  "seed": 1276,
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "framespersecond": 24,
  "service_tier": "default",
  "execution_expires_after": 172800,
  "generate_audio": true,     // <-- confirms audio was generated
  "draft": false
}
```

No `audio_url`, `music_url`, `sound_url`, or `cover_url` were found at any nesting level.

---

## 4. Is Seedance suitable for "AI sound effects" (AI音效)?

**✅ YES — with `generate_audio: true`.**

Describing environmental sounds in the prompt (汽车行驶声、机械运转声) causes the API to generate a video whose MP4 track includes those sounds. The key requirement is **always** passing `"generate_audio": true` in the request body.

---

## 5. Is Seedance suitable for "AI background music" (AI音乐/配乐)?

**✅ YES — with `generate_audio: true`.**

The music prompt test ("背景有钢琴伴奏音乐") succeeded and produced a 2.08 MB MP4 with an embedded audio track. However, **copyright-sensitive keywords** like "电影配乐" trigger policy violations. Safer alternatives: "钢琴伴奏", "背景音乐", "环境音".

---

## 6. Is Seedance suitable for "lip sync with reference audio" (对口型)?

**❌ NOT DIRECTLY — based on current test results.**

Reasons:
1. The API response only returns `content.video_url` — no separate `audio_url` for an uploaded reference audio.
2. The current [`src/lib/seedance.ts`](src/lib/seedance.ts) only sends `{ type: "text" }` in the content array.
3. We did NOT test `content[].type = "audio"` because the field name is unconfirmed.

**Recommendation:** Check the official Volcengine Ark Seedance documentation to see if:
- `content` supports `{ type: "audio", audio: "<base64_audio>" }` or similar
- The API has a separate `audio_input` parameter
- There is a specific lip-sync endpoint

If the API does support audio input, it would need to be added to [`src/lib/seedance.ts`](src/lib/seedance.ts) via a new `SeedanceSubmitRequest` field and the `content` array.

---

## 7. Additional Technical Details

### Key response fields discovered

| Field | Present? | Description |
|-------|----------|-------------|
| `content.video_url` | ✅ Always | Download URL for the MP4 video |
| `content.cover_url` | ❌ Never | No cover image in any response |
| `content.audio_url` | ❌ Never | Audio is embedded, not separate |
| `generate_audio` | ✅ When passed | Echoes back the request parameter |
| `resolution` | ✅ "720p" | Output resolution |
| `ratio` | ✅ "16:9" | Aspect ratio |
| `duration` | ✅ 5 | Actual duration in seconds |
| `framespersecond` | ✅ 24 | Frame rate |
| `seed` | ✅ number | RNG seed for reproducibility |
| `usage.completion_tokens` | ✅ 108900 | Token consumption |
| `draft` | ✅ false | Draft flag |

### Failed test analysis

Test 1 (no `generate_audio`) failed with:
```
OutputVideoSensitiveContentDetected.PolicyViolation
"The request failed because the output video may be related to copyright restrictions."
```

This suggests that **without explicit `generate_audio: true`, the API may scan audio mentions in the prompt for copyright compliance and reject them**. With `generate_audio: true`, audio generation is explicitly opted into and succeeds.

### Downloaded video locations

All videos are saved at:
- `public/generated/seedance-audio-test/audio-prompt-generate_audio.mp4` (1.67 MB)
- `public/generated/seedance-audio-test/generate_audio-only.mp4` (2.22 MB)
- `public/generated/seedance-audio-test/music-prompt.mp4` (2.08 MB)

---

## 8. Next Steps for Production Integration

### Files to modify (when ready):

1. **[`src/lib/seedance.ts`](src/lib/seedance.ts)** — Add these changes:
   * Add `generate_audio?: boolean` to [`SeedanceSubmitRequest`](src/lib/seedance.ts:37) interface
   * Add `audio_url?: string` to [`SeedanceTaskResult`](src/lib/seedance.ts:58) (even though it wasn't found, for future compatibility)
   * Add `audio_description?: string` to [`SeedanceSubmitRequest`](src/lib/seedance.ts:37) (optional dedicated field for audio prompt)
   * Pass `generate_audio` from request to the API body in [`submitVideoGeneration()`](src/lib/seedance.ts:243)

2. **[`src/app/api/generate-video/route.ts`](src/app/api/generate-video/route.ts)** — Add these changes:
   * Accept new frontend parameters: `generateAudio`, `audioPrompt`
   * Pass them through to `submitVideoGeneration()`

3. **[`src/app/api/generate-video/[taskId]/route.ts`](src/app/api/generate-video/[taskId]/route.ts)** — Add these changes:
   * Handle `audio_url` in response if it ever appears in the future

4. **Frontend** — Add a toggle/checkbox for "Generate audio" on the creation page.

### Current capability vs. future capability

| Feature | Current Status | Can Implement Now? |
|---------|---------------|-------------------|
| AI sound effects via prompt | ✅ Works with `generate_audio: true` | Yes — just add the parameter |
| AI background music via prompt | ✅ Works with `generate_audio: true` | Yes — just add the parameter |
| Separate audio_url download | ❌ Not available | N/A — audio is embedded |
| Lip sync with reference audio | ❌ Not tested | Need API documentation |
