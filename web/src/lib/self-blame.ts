import type { BlameLine } from "@/components/marketing/BlameReveal";

// Real `grain blame` output from this repository: the command dispatch in
// cmd/grain/main.go. The annotate/eval/calibrate cases were captured by the
// hook; hook/attest/blame predate it, so grain shows them as human.
export const BLAME_FILE = "cmd/grain/main.go";
export const BLAME_SUMMARY = { lines: 362, ai: 260, pct: 71 };
export const BLAME_LINES: BlameLine[] = [
  { ai: true, sha: "04ef67e", n: 37, text: "\tcase \"annotate\":" },
  { ai: true, sha: "04ef67e", n: 38, text: "\t\terr = cmdAnnotate(os.Args[2:])" },
  { ai: true, sha: "25d0dfc", n: 39, text: "\tcase \"eval\":" },
  { ai: true, sha: "25d0dfc", n: 40, text: "\t\terr = cmdEval(os.Args[2:])" },
  { ai: true, sha: "1ca4935", n: 41, text: "\tcase \"calibrate\":" },
  { ai: true, sha: "1ca4935", n: 42, text: "\t\terr = cmdCalibrate(os.Args[2:])" },
  { ai: false, sha: "2a65cf1", n: 43, text: "\tcase \"hook\":" },
  { ai: false, sha: "2a65cf1", n: 44, text: "\t\terr = cmdHook(os.Args[2:])" },
  { ai: false, sha: "2a65cf1", n: 45, text: "\tcase \"attest\":" },
  { ai: false, sha: "2a65cf1", n: 46, text: "\t\terr = cmdAttest(os.Args[2:])" },
  { ai: false, sha: "2a65cf1", n: 47, text: "\tcase \"blame\":" },
  { ai: false, sha: "2a65cf1", n: 48, text: "\t\terr = cmdBlame(os.Args[2:])" },
];
