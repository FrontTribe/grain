// Mock data for the dashboard UI. Swapped for real (Supabase) data later.

export type RepoRow = {
  name: string;
  human: number; // %
  ai: number;
  unc: number;
  status: "healthy" | "attention";
  lastScan: string;
  spark: number[]; // 0..1 series
};

export const org = { name: "Acme Corp", repos: 42, scannedToday: 38 };

export const kpis = {
  human: 73,
  ai: 22,
  unc: 5,
  aiDeltaPts: 3,
  openAttention: 7,
};

// Authorship over 6 months: [human%, ai%] per month.
export const trend6 = {
  months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
  human: [84, 83, 81, 79, 77, 76],
  ai: [16, 17, 19, 21, 23, 24],
  threshold: 40,
};

export const attention = [
  { repo: "payments-service", pr: 482, ai: 62, ago: "2h" },
  { repo: "auth-gateway", pr: 118, ai: 71, ago: "5h" },
  { repo: "billing-core", pr: 340, ai: 58, ago: "1d" },
  { repo: "ledger-api", pr: 77, ai: 55, ago: "1d" },
  { repo: "kyc-service", pr: 203, ai: 49, ago: "2d" },
];

export const repos: RepoRow[] = [
  { name: "payments-service", human: 71, ai: 24, unc: 5, status: "attention", lastScan: "2h ago", spark: [0.72, 0.68, 0.62, 0.55, 0.4, 0.36] },
  { name: "auth-gateway", human: 88, ai: 10, unc: 2, status: "healthy", lastScan: "5h ago", spark: [0.45, 0.5, 0.42, 0.46, 0.38, 0.4] },
  { name: "web-app", human: 52, ai: 44, unc: 4, status: "attention", lastScan: "1h ago", spark: [0.65, 0.58, 0.52, 0.44, 0.3, 0.22] },
  { name: "ledger-api", human: 80, ai: 17, unc: 3, status: "healthy", lastScan: "1d ago", spark: [0.4, 0.44, 0.44, 0.48, 0.44, 0.48] },
  { name: "docs-site", human: 38, ai: 58, unc: 4, status: "healthy", lastScan: "3h ago", spark: [0.6, 0.52, 0.48, 0.4, 0.36, 0.28] },
];
