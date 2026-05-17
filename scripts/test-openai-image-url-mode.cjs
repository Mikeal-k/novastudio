#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Test script: Verify if GPT Image 2 supports response_format: "url"
 *
 * This script:
 * 1. Tests gpt-image-2 with response_format: "url"
 * 2. Tests without response_format as baseline
 * 3. Reports exactly what fields the API returns
 * 4. Determines if url/b64_json mode is supported
 *
 * Usage:
 *   node scripts/test-openai-image-url-mode.cjs
 *
 * Reads OPENAI_API_KEY and OPENAI_PROXY_URL from .env.local.
 * Does NOT print full API key.
 *
 * Expected outputs:
 *   - HTTP status code
 *   - Response body size
 *   - Returned field keys (url / b64_json)
 *   - Final conclusion: whether GPT Image 2 supports url mode
 */

"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const { SocksProxyAgent } = require("socks-proxy-agent");

// ═══════════════════════════════════════════════════════════════════════════
//  Load .env.local
// ═══════════════════════════════════════════════════════════════════════════

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
console.log("");

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

const TIMEOUT_MS = 120_000;

function createAgent() {
  if (PROXY_URL && PROXY_URL.startsWith("socks")) {
    try {
      return new SocksProxyAgent(PROXY_URL);
    } catch (e) {
      console.log("  ⚠️  Failed to create SOCKS agent:", e.message);
    }
  }
  return undefined;
}

/**
 * Make a POST request to OpenAI /v1/images/generations.
 * Returns { status, headers, body (raw string), actualBytes }.
 */
function postOpenAI(bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    let settled = false;

    function settle(fn, val) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(val);
    }

    const timeout = setTimeout(() => {
      req.destroy(new Error("Timeout"));
    }, TIMEOUT_MS);

    const agent = createAgent();
    const options = {
      hostname: "api.openai.com",
      path: "/v1/images/generations",
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      timeout: TIMEOUT_MS,
    };
    if (agent) options.agent = agent;

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        settle(resolve, {
          status: res.statusCode,
          headers: res.headers,
          body: data,
          actualBytes: Buffer.byteLength(data, "utf8"),
        });
      });
      res.on("error", (err) => settle(reject, err));
    });

    req.on("error", (err) => settle(reject, err));
    req.write(bodyStr);
    req.end();
  });
}

function analyzeResponse(label, result) {
  console.log(`\n─── ${label} ───`);
  console.log(`   HTTP status:      ${result.status}`);
  console.log(`   Content-Length:   ${result.headers["content-length"] ?? "unknown"}`);
  console.log(`   Actual bytes:     ${result.actualBytes}`);

  let parsed;
  try {
    parsed = JSON.parse(result.body);
  } catch {
    console.log(`   ❌ JSON parse FAILED (response truncated or malformed)`);
    console.log(`      First 200 chars: ${result.body.slice(0, 200)}`);
    return { parsed: null, hasUrl: false, hasB64: false, error: "parse_failed" };
  }

  console.log(`   Response keys:    ${Object.keys(parsed).join(", ")}`);

  // Check for API-level errors
  if (parsed.error) {
    const errMsg = parsed.error.message ?? JSON.stringify(parsed.error);
    const errType = parsed.error.type ?? "N/A";
    const errCode = parsed.error.code ?? "N/A";
    console.log(`   ⚠️  API Error:`);
    console.log(`      message: ${errMsg}`);
    console.log(`      type:    ${errType}`);
    console.log(`      code:    ${errCode}`);
    return { parsed, hasUrl: false, hasB64: false, error: errMsg, errorType: errType };
  }

  // Check data array
  const item0 = parsed.data?.[0];
  if (!item0) {
    console.log(`   ⚠️  No data[0] in response`);
    return { parsed, hasUrl: false, hasB64: false, error: "no_data" };
  }

  const itemKeys = Object.keys(item0);
  const hasUrl = !!item0.url;
  const hasB64 = !!item0.b64_json;

  console.log(`   data[0] keys:     ${itemKeys.join(", ")}`);
  console.log(`   Has url:          ${hasUrl}`);
  console.log(`   Has b64_json:     ${hasB64}`);
  if (hasUrl) console.log(`   url value:       ${item0.url}`);
  if (hasB64) console.log(`   b64_json length: ${item0.b64_json.length} chars`);

  return { parsed, hasUrl, hasB64, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
  console.log("=".repeat(64));
  console.log("   GPT Image 2 — response_format URL Mode Test");
  console.log("=".repeat(64));

  // ── Test 1: With response_format: "url" ─────────────────────────────
  const testUrlBody = {
    model: "gpt-image-2",
    prompt: "A cute orange cat sitting on a windowsill, digital art style",
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 80,
    response_format: "url",
    n: 1,
  };

  console.log(`\n📤 Test 1 — With response_format: "url"`);
  console.log(`   model:             ${testUrlBody.model}`);
  console.log(`   size:              ${testUrlBody.size}`);
  console.log(`   quality:           ${testUrlBody.quality}`);
  console.log(`   output_format:     ${testUrlBody.output_format}`);
  console.log(`   output_compression: ${testUrlBody.output_compression}`);
  console.log(`   response_format:   ${testUrlBody.response_format}`);

  let r1;
  try {
    r1 = await postOpenAI(testUrlBody);
  } catch (err) {
    console.log(`\n❌ Test 1 request failed: ${err.message}`);
    console.log("   (This is a connectivity issue, not a URL mode issue)");
    r1 = null;
  }

  let t1Result = null;
  if (r1) {
    t1Result = analyzeResponse("Test 1 — URL mode", r1);
  }

  // ── Test 2: Without response_format (baseline) ──────────────────────
  const testB64Body = {
    model: "gpt-image-2",
    prompt: "A cute orange cat sitting on a windowsill, digital art style",
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 95,
    n: 1,
  };

  console.log(`\n📤 Test 2 — WITHOUT response_format (baseline / b64_json)`);
  console.log(`   model:             ${testB64Body.model}`);
  console.log(`   size:              ${testB64Body.size}`);
  console.log(`   quality:           ${testB64Body.quality}`);
  console.log(`   output_format:     ${testB64Body.output_format}`);
  console.log(`   output_compression: ${testB64Body.output_compression}`);
  console.log(`   response_format:   (omitted → default)`);

  let r2;
  try {
    r2 = await postOpenAI(testB64Body);
  } catch (err) {
    console.log(`\n❌ Test 2 request failed: ${err.message}`);
    r2 = null;
  }

  let t2Result = null;
  if (r2) {
    t2Result = analyzeResponse("Test 2 — Baseline", r2);
  }

  // ── Final Conclusion ─────────────────────────────────────────────────
  console.log("\n" + "=".repeat(64));
  console.log("   FINAL CONCLUSION");
  console.log("=".repeat(64));

  if (t1Result) {
    if (t1Result.hasUrl) {
      console.log("\n   ✅✅✅ GPT Image 2 SUPPORTS response_format: 'url'");
      console.log("       ╰ The API returned a URL instead of b64_json");
      console.log("       ╰ Response is small → much lower chance of proxy truncation");
      console.log("       ╰ Server can download the URL separately and save locally");
    } else if (t1Result.hasB64) {
      console.log("\n   ⚠️  GPT Image 2 IGNORED response_format: 'url'");
      console.log("       ╰ The API still returned b64_json despite requesting url");
      console.log("       ╰ This means gpt-image-2 does NOT respect response_format");
      console.log("       ╰ Must use b64_json fallback (with compression retry)");
    } else if (t1Result.error && t1Result.errorType === "invalid_request_error") {
      console.log("\n   ❌ GPT Image 2 REJECTS response_format: 'url'");
      console.log("       ╰ API returned an invalid_request_error");
      console.log("       ╰ Error message: " + t1Result.error);
      console.log("       ╰ Must use b64_json mode only");
    } else if (t1Result.error && t1Result.error !== "parse_failed") {
      console.log("\n   ⚠️  GPT Image 2 returned an error with response_format: 'url'");
      console.log("       ╰ Error: " + t1Result.error);
      console.log("       ╰ This may indicate the model doesn't support url mode");
    } else if (t1Result.error === "parse_failed") {
      console.log("\n   ❌ GPT Image 2 response was truncated/malformed");
      console.log("       ╰ Cannot determine URL mode support from this test");
      console.log("       ╰ Check proxy stability and retry");
    } else {
      console.log("\n   ⚠️  GPT Image 2 response format is unclear");
      console.log("       ╰ Neither url nor b64_json found in response");
    }
  } else {
    console.log("\n   ⚠️  Test 1 failed due to connectivity issues");
    console.log("       ╰ Cannot determine GPT Image 2 URL mode support");
    if (PROXY_URL) {
      console.log(`       ╰ Check if proxy is running: ${PROXY_URL}`);
      console.log("       ╰ Or try running without proxy (direct connection)");
    }
  }

  // Additional info from baseline
  if (t2Result) {
    console.log("");
    if (t2Result.hasB64) {
      console.log("   ℹ️  Baseline confirms: GPT Image 2 CAN generate images");
      console.log(`       ╰ Returns b64_json by default (length: ${t2Result.parsed?.data?.[0]?.b64_json?.length ?? "N/A"} chars)`);
    }
  }

  console.log("");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
