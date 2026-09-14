// Real numbers from grain scanning its own repository (FrontTribe/grain),
// generated 2026-09-14 from grain.json. Regenerate with:
//   grain scan && node scripts/self-scan.mjs
export const SELF_SCAN = {
  "generated": "2026-09-14",
  "commits": 87,
  "human": 2,
  "ai": 98,
  "attested": 11,
  "declared": 87,
  "inferred": 0,
  "risk": {
    "lines": 416,
    "unreviewed": 416,
    "paths": [
      {
        "path": "workflows",
        "lines": 155
      },
      {
        "path": "auth",
        "lines": 129
      },
      {
        "path": "login",
        "lines": 74
      },
      {
        "path": "billing",
        "lines": 58
      }
    ]
  },
  "outcomes": {
    "ai_lines": 2438,
    "ai_reworked": 21,
    "human_lines": 168,
    "human_reworked": 4
  }
} as const;

// One entry per commit, oldest first: authorship class and lines changed.
export const SELF_COMMITS: { c: "h" | "a" | "u"; w: number }[] = [{"c":"a","w":1913},{"c":"a","w":647},{"c":"a","w":413},{"c":"a","w":1327},{"c":"a","w":253},{"c":"a","w":2},{"c":"a","w":45},{"c":"a","w":14},{"c":"a","w":664},{"c":"a","w":377},{"c":"a","w":1426},{"c":"a","w":402},{"c":"a","w":246},{"c":"a","w":215},{"c":"a","w":78},{"c":"a","w":120},{"c":"a","w":184},{"c":"a","w":72},{"c":"a","w":12},{"c":"a","w":179},{"c":"a","w":29},{"c":"a","w":7490},{"c":"a","w":370},{"c":"a","w":620},{"c":"a","w":311},{"c":"a","w":685},{"c":"a","w":0},{"c":"a","w":102},{"c":"a","w":46},{"c":"a","w":352},{"c":"a","w":138},{"c":"a","w":271},{"c":"a","w":380},{"c":"a","w":377},{"c":"a","w":239},{"c":"a","w":242},{"c":"a","w":179},{"c":"a","w":220},{"c":"a","w":52},{"c":"a","w":443},{"c":"a","w":116},{"c":"a","w":131},{"c":"a","w":209},{"c":"a","w":2},{"c":"a","w":266},{"c":"a","w":105},{"c":"a","w":198},{"c":"a","w":509},{"c":"a","w":206},{"c":"a","w":359},{"c":"a","w":138},{"c":"a","w":123},{"c":"a","w":257},{"c":"a","w":91},{"c":"a","w":69},{"c":"a","w":2},{"c":"a","w":160},{"c":"a","w":228},{"c":"a","w":0},{"c":"u","w":151},{"c":"a","w":8},{"c":"a","w":640},{"c":"a","w":402},{"c":"a","w":60},{"c":"a","w":76},{"c":"a","w":219},{"c":"a","w":146},{"c":"a","w":89},{"c":"a","w":231},{"c":"a","w":161},{"c":"a","w":251},{"c":"u","w":0},{"c":"u","w":100},{"c":"a","w":106},{"c":"u","w":0},{"c":"a","w":38},{"c":"a","w":17},{"c":"a","w":659},{"c":"a","w":77},{"c":"a","w":76},{"c":"a","w":417},{"c":"a","w":170},{"c":"a","w":38},{"c":"a","w":533},{"c":"a","w":2},{"c":"a","w":379},{"c":"a","w":1288}];
