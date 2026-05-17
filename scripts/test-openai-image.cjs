#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Test script for OpenAI Images API (gpt-image-1.5 / gpt-image-2).
 *
 * Usage:
 *   node scripts/test-openai-image.cjs              → Mode A (default: 1024x1024, low, compression 80)
 *   node scripts/test-openai-image.cjs --mode b     → Mode B (minimal: 1024x1024, low, compression 95)
 *   node scripts/test-openai-image.cjs --mode url   → Mode URL (test if response_format: "url" works)
 *
 * Each mode outputs:
 *   - HTTP status
 *   - content-length
 *   - actual received bytes
 *   - JSON parse success/failure
 *   - Whether data[0].b64_json or data[0].url was received
 *   - Clear failure classification: timeout / aborted / truncated / parse_failed / http_error
 *
 * Reads OPENAI_API_KEY and OPENAI_PROXY_URL from .env.local.
 */

"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const { SocksProxyAgent } = require("socks-proxy-agent");

// ── Parse args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MODE = args.includes("--mode")
  ? args[args.indexOf("--mode") + 1]?.toLowerCase() ?? "a"
  : "a";

if (!["a", "b", "url"].includes(MODE)) {
  console.error(`❌ Unknown mode: "${MODE}". Use "a", "b", or "url".`);
  process.exit(1);
}

// ── Load .env.local ───────────────────────────────────────────────────────
function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const envLocalPath = path.resolve(__dirname, "..", ".env.local");
if (!fs.existsSync(envLocalPath)) {
  console.error("❌ .env.local not found at:", envLocalPath);
  process.exit(1);
}

const env = loadEnv(envLocalPath);
const API_KEY = env.OPENAI_API_KEY;
const PROXY_URL = env.OPENAI_PROXY_URL;

if (!API_KEY) {
  console.error("❌ OPENAI_API_KEY is not set in .env.local");
  process.exit(1);
}

const maskedKey =
  API_KEY.length > 12
    ? API_KEY.slice(0, 8) + "..." + API_KEY.slice(-4)
    : "***too-short***";
console.log("🔑 OPENAI_API_KEY:", maskedKey);
console.log("🔗 OPENAI_PROXY_URL:", PROXY_URL || "(none)");

// ── Request configuration per mode ────────────────────────────────────────
let requestBody;
let modeLabel;

if (MODE === "b") {
  // Mode B: minimized — smallest workable config (max compression min size)
  modeLabel = "B (minimal)";
  requestBody = {
    model: "gpt-image-2",
    prompt: "A cute orange cat",
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 95,
    n: 1,
  };
} else if (MODE === "url") {
  // Mode URL: test if response_format: "url" is supported by gpt-image-2
  modeLabel = "URL (response_format test)";
  requestBody = {
    model: "gpt-image-2",
    prompt: "A cute orange cat sitting on a windowsill, digital art style",
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 80,
    response_format: "url",
    n: 1,
  };
} else {
  // Mode A: default test
  modeLabel = "A (default)";
  requestBody = {
    model: "gpt-image-2",
    prompt: "A cute orange cat sitting on a windowsill, digital art style",
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 80,
    n: 1,
  };
}

const TIMEOUT_MS = 300_000;
const body = JSON.stringify(requestBody);

console.log(`🧪 Mode: ${modeLabel}`);
console.log(`\n📤 Request:`);
for (const [k, v] of Object.entries(requestBody)) {
  console.log(`   ${k.padEnd(22)} = ${JSON.stringify(v)}`);
}
console.log(`   ${"timeout".padEnd(22)} = ${TIMEOUT_MS / 1000}s`);

// ── Make the HTTPS request ────────────────────────────────────────────────
let socksAgent = null;
if (PROXY_URL && PROXY_URL.startsWith("socks")) {
  try {
    socksAgent = new SocksProxyAgent(PROXY_URL);
    console.log(`🧦 SOCKS proxy agent created for: ${PROXY_URL}`);
  } catch (e) {
    console.error(
      "⚠️  Failed to create SOCKS proxy agent, falling back to direct:",
      e.message
    );
  }
}

const options = {
  hostname: "api.openai.com",
  path: "/v1/images/generations",
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
  timeout: TIMEOUT_MS,
};

if (socksAgent) {
  options.agent = socksAgent;
}

console.log(`\n⏳ Sending request to api.openai.com/v1/images/generations...\n`);

const req = https.request(options, (res) => {
  const { statusCode, statusMessage, headers } = res;
  const contentLength = headers["content-length"]
    ? parseInt(headers["content-length"], 10)
    : null;

  console.log(`📥 HTTP ${statusCode} ${statusMessage ?? ""}`);
  console.log(`   content-type:     ${headers["content-type"] ?? "N/A"}`);
  console.log(`   content-length:   ${contentLength ?? "unknown"}`);

  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("aborted", () => {
    const actualBytes = Buffer.byteLength(data, "utf8");
    console.log(`   ⚠️  Response ABORTED (proxy disconnect mid-stream)`);
    console.log(`   Received so far: ${data.length} chars (${actualBytes} bytes)`);
    const result = buildResult(false, statusCode, contentLength, actualBytes, data, true, false);
    printFailure(result, "aborted", "响应在传输过程中被代理中断（aborted），请检查代理稳定性");
    process.exit(1);
  });

  res.on("error", (streamErr) => {
    const actualBytes = Buffer.byteLength(data, "utf8");
    console.error(`\n❌ Failure: response_stream_error`);
    console.error(`   ${streamErr.message}`);
    const result = buildResult(false, statusCode, contentLength, actualBytes, data, false, true);
    printFailure(result, "stream_error", streamErr.message);
    process.exit(1);
  });

  res.on("end", () => {
    const actualBytes = Buffer.byteLength(data, "utf8");
    const truncated = contentLength !== null && actualBytes < contentLength;

    console.log(`   body length:      ${data.length} chars (${actualBytes} bytes)`);
    if (contentLength !== null) {
      if (truncated) {
        console.log(`   ⚠️  TRUNCATED: content-length=${contentLength}, actual=${actualBytes}, missing=${contentLength - actualBytes} bytes`);
      } else if (actualBytes === contentLength) {
        console.log(`   ✅ Complete: received all ${contentLength} bytes as advertised`);
      } else {
        console.log(`   ℹ️  Extra bytes: content-length=${contentLength}, actual=${actualBytes}`);
      }
    }

    // Parse JSON
    let parsed;
    let parseSucceeded = false;
    try {
      parsed = JSON.parse(data);
      parseSucceeded = true;
    } catch {
      parseSucceeded = false;
    }

    const result = buildResult(parseSucceeded, statusCode, contentLength, actualBytes, data, false, false);

    // ── Determine overall success / failure ────────────────────────────
    const isNon200 = statusCode !== 200;

    if (isNon200) {
      let failureSubtype = "http_error";
      if (statusCode === 401) failureSubtype = "invalid_key";
      else if (statusCode === 403) failureSubtype = "permission_denied";
      else if (statusCode === 429) failureSubtype = "rate_limited";
      printFailure(result, failureSubtype, extractErrorMessage(parsed, statusCode));
      process.exit(1);
    }

    if (truncated) {
      printFailure(result, "truncated", "OpenAI 响应被截断：content-length 大于实际接收字节数，请检查代理稳定性");
      process.exit(1);
    }

    if (!parseSucceeded) {
      const snippet = data.length > 200 ? data.slice(0, 200) + "..." : data;
      printFailure(result, "parse_failed", `JSON 解析失败，前 200 字符: ${snippet}`);
      process.exit(1);
    }

    // ── Success path ───────────────────────────────────────────────────
    const imageData = parsed?.data?.[0];
    const hasB64 = !!imageData?.b64_json;
    const hasUrl = !!imageData?.url;

    console.log(`\n✅ Success!`);
    printSummary(result);
    console.log(`   Has b64_json:     ${hasB64}`);
    console.log(`   Has url:          ${hasUrl}`);

    if (hasB64) {
      console.log(`   b64_json length:  ${imageData.b64_json.length} chars`);
      const tmpDir = path.resolve(__dirname, "..", "tmp");
      const suffix = MODE === "b" ? "b" : MODE === "url" ? "url" : "a";
      const outPath = path.join(tmpDir, `openai-image-test-${suffix}.webp`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const buf = Buffer.from(imageData.b64_json, "base64");
      fs.writeFileSync(outPath, buf);
      console.log(`\n💾 Saved test image to: ${outPath}`);
      console.log(`   File size: ${buf.length} bytes`);

      // Compare b64 length to content-length expectations
      console.log(`   Estimated response overhead ~` +
        (contentLength
          ? `${contentLength - imageData.b64_json.length} bytes`
          : " N/A (no content-length)"));
    } else if (hasUrl) {
      console.log(`   url: ${imageData.url}`);
      console.log(`\n⚠️  OpenAI returned a URL (not b64_json). response_format="url" IS supported.`);
    } else {
      console.error("\n❌ Response has no b64_json or url field");
      console.error("   Data:", JSON.stringify(imageData));
      process.exit(1);
    }

    console.log("\n🎉 Test completed successfully!");
    process.exit(0);
  });
});

req.on("timeout", () => {
  console.error(`\n❌ Failure: timeout`);
  console.error(`   Request timeout after ${TIMEOUT_MS / 1000}s`);
  printFailure(null, "timeout", "请求超时，未收到完整响应");
  req.destroy();
  process.exit(1);
});

req.on("error", (err) => {
  console.error("\n❌ Failure: request_error");
  console.error(`   ${err.message}`);
  const subtype = err.message.includes("ECONNREFUSED") || err.message.includes("ENOTFOUND")
    ? "proxy_unreachable"
    : "request_failed";
  const hint = err.message.includes("ECONNREFUSED") || err.message.includes("ENOTFOUND")
    ? "无法连接到代理，请检查代理是否运行"
    : err.message;
  printFailure(null, subtype, hint);
  process.exit(1);
});

req.write(body);
req.end();

// ── Safeguard timeout ────────────────────────────────────────────────────
setTimeout(() => {
  console.error(`\n❌ Failure: safeguard_timeout`);
  console.error(`   No response after ${(TIMEOUT_MS + 10000) / 1000}s`);
  req.destroy();
  process.exit(1);
}, TIMEOUT_MS + 10000).unref();

// ═════════════════════════════════════════════════════════════════════════
//  Helper functions
// ═════════════════════════════════════════════════════════════════════════

function buildResult(parseSucceeded, statusCode, contentLength, actualBytes, data, aborted, streamError) {
  return {
    statusCode,
    contentLength,
    actualBytes,
    dataLength: data ? data.length : 0,
    parseSucceeded,
    aborted,
    streamError,
    truncated: contentLength !== null && actualBytes < contentLength,
  };
}

function printSummary(r) {
  console.log("\n═══ SUMMARY ═══");
  console.log(`HTTP status:       ${r.statusCode ?? "N/A"}`);
  console.log(`Content-Length:    ${r.contentLength ?? "N/A"}`);
  console.log(`Actual received:   ${r.actualBytes} bytes`);
  console.log(`JSON parse:        ${r.parseSucceeded ? "✅" : "❌"}`);
  let cause = "unknown";
  if (r.aborted) cause = "aborted";
  else if (r.streamError) cause = "stream_error";
  else if (r.truncated) cause = "truncated";
  else if (!r.parseSucceeded) cause = "parse_failed";
  else cause = "none (success)";
  console.log(`Failure cause:     ${cause}`);
  console.log("═══════════════════");
}

function printFailure(r, cause, hint) {
  console.log(`\n❌ Failure: ${cause}`);
  console.log(`💡 ${hint}`);
  if (r) {
    printSummary(r);
  } else {
    console.log("\n═══ SUMMARY ═══");
    console.log(`Content-Length:    N/A`);
    console.log(`Actual received:   0 bytes`);
    console.log(`JSON parse:        N/A`);
    console.log(`Failure cause:     ${cause}`);
    console.log("═══════════════════");
  }
}

function extractErrorMessage(parsed, statusCode) {
  if (parsed && parsed.error && parsed.error.message) {
    return `OpenAI HTTP ${statusCode}: ${parsed.error.message}`;
  }
  return `OpenAI returned HTTP ${statusCode}`;
}
