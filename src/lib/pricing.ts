/**
 * Unified pricing configuration.
 *
 * All model credit costs, recharge packages, and duration-based pricing
 * live here so frontend and backend stay in sync.
 */

// ─── Model credit costs (image models) ──────────────────────────────────────

export const MODEL_CREDIT_COSTS: Record<string, number> = {
  "gpt-image-1.5": 30,
  "gpt-image-2": 35,
};

// ─── Seedance 2.0 duration → credit cost map ───────────────────────────────

export const SEEDANCE_DURATION_COST: Record<number, number> = {
  4: 38,
  5: 49,
  7: 60,
  8: 71,
  9: 82,
  10: 93,
  11: 104,
  12: 115,
  13: 126,
  14: 137,
  15: 148,
};

/** Valid Seedance durations (seconds). No 6s, no 30s. */
export const SEEDANCE_DURATIONS = [4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// ─── Recharge packages ──────────────────────────────────────────────────────

export interface RechargePackage {
  id: string;
  name: string;
  price: string;
  amountYuan: number;
  credits: number;
  popular?: boolean;
  description: string;
}

export const RECHARGE_PACKAGES: RechargePackage[] = [
  {
    id: "basic-29",
    name: "基础包",
    price: "¥29.9",
    amountYuan: 29.9,
    credits: 150,
    popular: false,
    description: "适合体验 AI 图片/视频生成",
  },
  {
    id: "basic-39",
    name: "标准包",
    price: "¥39.9",
    amountYuan: 39.9,
    credits: 215,
    popular: false,
    description: "适合轻度创作和测试",
  },
  {
    id: "basic-49",
    name: "进阶包",
    price: "¥49.9",
    amountYuan: 49.9,
    credits: 285,
    popular: true,
    description: "性价比之选 · 适合日常创作",
  },
  {
    id: "basic-59",
    name: "专业包",
    price: "¥59.9",
    amountYuan: 59.9,
    credits: 360,
    popular: false,
    description: "适合批量生成短视频素材",
  },
  {
    id: "basic-69",
    name: "旗舰包",
    price: "¥69.9",
    amountYuan: 69.9,
    credits: 440,
    popular: false,
    description: "适合矩阵式内容生产",
  },
];

/** Lookup helper for server-side validation */
export const RECHARGE_PACKAGE_MAP = new Map(
  RECHARGE_PACKAGES.map((pkg) => [pkg.id, pkg])
);
