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

// ---- Trends screen ----
export const trend12 = {
  months: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
  human: [86, 85, 85, 83, 82, 81, 80, 78, 77, 76, 75, 74],
  ai: [12, 13, 13, 15, 16, 17, 18, 20, 21, 22, 23, 24],
  threshold: 40,
};
export const trendsKpis = { orgAi: 24, yoy: 12, fastest: "web-app", fastestDelta: 18, over40: 4 };
export const teams = [
  { name: "Platform", repos: 14, ai: 16, spark: [0.3, 0.32, 0.34, 0.36, 0.38, 0.4], yoy: 5, up: false },
  { name: "Web", repos: 9, ai: 44, spark: [0.2, 0.3, 0.4, 0.5, 0.62, 0.72], yoy: 21, up: true },
  { name: "Payments", repos: 7, ai: 19, spark: [0.36, 0.36, 0.34, 0.38, 0.36, 0.38], yoy: 4, up: true },
  { name: "Data", repos: 8, ai: 31, spark: [0.28, 0.34, 0.38, 0.46, 0.54, 0.6], yoy: 14, up: true },
  { name: "Mobile", repos: 4, ai: 27, spark: [0.34, 0.4, 0.44, 0.5, 0.56, 0.62], yoy: 9, up: true },
];

// ---- Activity screen ----
export const activityDays = [
  {
    label: "Today",
    events: [
      { kind: "attention", text: "**Attention:** payments-service #482 is 62% AI in a human-owned path", sub: "Add retry logic to the payment webhook · 1 review requested", ago: "2h ago" },
      { kind: "scan", text: "Scan finished · web-app", sub: "220 commits · AI share up to 44%", ai: 44, ago: "3h ago" },
      { kind: "policy", text: "**Maya G.** set auth-gateway enforcement to **Block merge**", sub: "Threshold lowered to 25%", ago: "4h ago" },
      { kind: "attention", text: "**Attention:** billing-core #340 is 58% AI", sub: "Generate invoice PDF renderer", ai: 58, ago: "5h ago" },
    ],
  },
  {
    label: "Yesterday",
    events: [
      { kind: "repo", text: "**Dan P.** connected ledger-api", sub: "Now scanning · 77 commits", ago: "1d ago" },
      { kind: "scan", text: "Weekly org scan finished · 42 repositories", sub: "Org AI share 22% · +3 pts vs last week", ago: "1d ago" },
      { kind: "scan", text: "Scan finished · auth-gateway", sub: "340 commits · 10% AI · healthy", ai: 10, ago: "1d ago" },
    ],
  },
];

// ---- Policy screen ----
export const policy = {
  threshold: 40,
  confidence: 0.5,
  enforcement: "comment" as "comment" | "review" | "block",
  humanOwned: ["src/auth/**", "src/payments/**", "infra/**", "**/migrations/**"],
  overrides: [
    { repo: "payments-service", threshold: 30, enforcement: "block", paths: 2, floor: 0.6 },
    { repo: "auth-gateway", threshold: 25, enforcement: "block", paths: 3, floor: 0.6 },
    { repo: "web-app", threshold: 60, enforcement: "comment", paths: 0, floor: 0.5 },
    { repo: "docs-site", threshold: 80, enforcement: "comment", paths: 0, floor: 0.5 },
  ],
};

// ---- Settings screen ----
export const workspace = { name: "Acme Corp", slug: "acme" };
export const members = [
  { name: "Maya Green", initials: "MG", email: "maya@acme.com", role: "admin", active: "now" },
  { name: "Dan Park", initials: "DP", email: "dan@acme.com", role: "admin", active: "2h ago" },
  { name: "Sam Lee", initials: "SL", email: "sam@acme.com", role: "member", active: "1d ago" },
  { name: "Ravi Kumar", initials: "RK", email: "ravi@acme.com", role: "member", active: "3d ago" },
];
export const plan = { name: "Team", price: "$0 / seat · early access", seats: 4 };

// ---- Repo detail ----
export const repoDetail = {
  name: "payments-service",
  human: 76,
  ai: 20,
  unc: 4,
  commits: 400,
  lastScan: "2h ago",
  owned: ["src/auth/**", "src/payments/**"],
  byDir: [
    { path: "src/auth/", human: 94, ai: 6, owned: true },
    { path: "src/payments/", human: 82, ai: 18, owned: true },
    { path: "src/api/", human: 68, ai: 32, owned: false },
    { path: "src/ui/", human: 41, ai: 59, owned: false },
    { path: "tests/", human: 33, ai: 67, owned: false },
  ],
  prs: [
    { title: "Add retry logic to webhook", pr: 482, ai: 62 },
    { title: "Refactor settlement guard", pr: 479, ai: 12 },
    { title: "Fix idempotency key bug", pr: 476, ai: 8 },
    { title: "Generate API client types", pr: 472, ai: 88 },
    { title: "Tighten auth token TTL", pr: 470, ai: 3 },
  ],
};
