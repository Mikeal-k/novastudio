/**
 * scripts/cleanup-stale-image-tasks.cjs
 *
 * Standalone script to find and mark stale GPT Image 1.5 / GPT Image 2 tasks.
 *
 * A task is considered "stale" if:
 *   - model = "GPT Image 1.5" or "GPT Image 2"
 *   - status = "running" or "pending"
 *   - created_at > 3 minutes ago
 *
 * Behavior:
 *   - If charged_at IS NOT null: refunds credits (prevents double refund)
 *   - If charged_at IS null: no refund (nothing was charged)
 *   - Does NOT touch Seedance tasks
 *
 * Usage:
 *   node scripts/cleanup-stale-image-tasks.cjs
 *
 * Environment variables (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// Load .env.local
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnvFile(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Try loading from various locations
const envPaths = [
  path.join(__dirname, "..", ".env.local"),
  path.join(__dirname, "..", ".env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`[cleanup] Loading env from: ${envPath}`);
    loadEnvFile(envPath);
    break;
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[cleanup] Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("[cleanup] Make sure these are set in .env.local");
  process.exit(1);
}

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const TARGET_MODELS = ["GPT Image 1.5", "GPT Image 2"];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[cleanup] ========================================");
  console.log("[cleanup] Stale Image Task Cleanup Script");
  console.log("[cleanup] ========================================");
  console.log(`[cleanup] Target models: ${TARGET_MODELS.join(", ")}`);
  console.log(`[cleanup] Timeout: ${TIMEOUT_MS / 1000}s`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const cutoffTime = new Date(Date.now() - TIMEOUT_MS).toISOString();
  console.log(`[cleanup] Cutoff time: ${cutoffTime}`);
  console.log("");

  // ── 1. Find stale tasks ──────────────────────────────────────────────────

  const { data: staleTasks, error: queryError } = await supabase
    .from("generations")
    .select("*")
    .in("model", TARGET_MODELS)
    .in("status", ["running", "pending"])
    .lt("created_at", cutoffTime)
    .order("created_at", { ascending: true });

  if (queryError) {
    console.error("[cleanup] Query error:", queryError);
    process.exit(1);
  }

  if (!staleTasks || staleTasks.length === 0) {
    console.log("[cleanup] ✅ No stale tasks found. Everything looks good!");
    process.exit(0);
  }

  console.log(`[cleanup] Found ${staleTasks.length} stale task(s):`);
  console.log("");

  for (const task of staleTasks) {
    const age = Math.round(
      (Date.now() - new Date(task.created_at).getTime()) / 1000
    );
    const ageStr = age >= 60 ? `${Math.round(age / 60)}m ${age % 60}s` : `${age}s`;
    console.log(
      `  - ${task.id.slice(0, 8)}... | ${task.model.padEnd(16)} | status=${task.status.padEnd(8)} | age=${ageStr.padEnd(8)} | charged=${task.charged_at ? "yes" : "no "} | cost=${task.cost}`
    );
  }

  console.log("");
  console.log(`[cleanup] Processing ${staleTasks.length} task(s)...`);
  console.log("");

  // ── 2. Process each task ────────────────────────────────────────────────

  let cleaned = 0;
  let refunded = 0;
  let errors = 0;

  for (const task of staleTasks) {
    try {
      const isCharged = !!task.charged_at;
      let taskRefunded = false;

      // ── 2a. If charged, refund credits ────────────────────────────────
      if (isCharged) {
        // Check for existing refund to avoid double refund
        const { data: existingRefunds } = await supabase
          .from("credit_transactions")
          .select("id")
          .eq("generation_id", task.id)
          .eq("type", "admin_refund");

        const alreadyRefunded = existingRefunds && existingRefunds.length > 0;

        if (!alreadyRefunded) {
          // Get current user balance
          const { data: profile } = await supabase
            .from("profiles")
            .select("credits")
            .eq("id", task.user_id)
            .single();

          if (profile) {
            const currentBalance = profile.credits ?? 0;
            const newBalance = currentBalance + (task.cost ?? 0);

            await supabase
              .from("profiles")
              .update({ credits: newBalance, updated_at: new Date().toISOString() })
              .eq("id", task.user_id);

            await supabase.from("credit_transactions").insert({
              user_id: task.user_id,
              type: "admin_refund",
              amount: task.cost ?? 0,
              balance_after: newBalance,
              generation_id: task.id,
              description: `超时任务自动退款（${task.model}，${task.cost} 积分）`,
            });

            taskRefunded = true;
            refunded++;
            console.log(
              `  ✅ Refunded ${task.cost} credits | user=${task.user_id.slice(0, 8)}... | task=${task.id.slice(0, 8)}...`
            );
          }
        } else {
          console.log(
            `  ℹ️  Already refunded | task=${task.id.slice(0, 8)}... — skipping refund`
          );
        }
      }

      // ── 2b. Mark task as failed ───────────────────────────────────────
      const errorMsg = "图片生成任务超时（超过 3 分钟无响应），自动标记为失败";

      await supabase
        .from("generations")
        .update({
          status: "failed",
          error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      cleaned++;
      console.log(
        `  ✅ Marked as failed | task=${task.id.slice(0, 8)}... | model=${task.model} | refunded=${isCharged && taskRefunded ? "yes" : "no"}`
      );
    } catch (processError) {
      errors++;
      const msg =
        processError instanceof Error ? processError.message : "Unknown error";
      console.error(
        `  ❌ Error processing task ${task.id.slice(0, 8)}...: ${msg}`
      );
    }
  }

  // ── 3. Summary ──────────────────────────────────────────────────────────

  console.log("");
  console.log("[cleanup] ========================================");
  console.log("[cleanup] Cleanup complete!");
  console.log(`[cleanup]   Total stale tasks: ${staleTasks.length}`);
  console.log(`[cleanup]   Marked as failed:  ${cleaned}`);
  console.log(`[cleanup]   Credits refunded:  ${refunded}`);
  console.log(`[cleanup]   Errors:            ${errors}`);
  console.log("[cleanup] ========================================");

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[cleanup] Fatal error:", err);
  process.exit(1);
});
