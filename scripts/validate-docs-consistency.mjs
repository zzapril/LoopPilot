#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const requiredDocs = [
  "docs/LoopPilot_PRD_v0.2.md",
  "docs/LoopPilot_Technical_Design_v0.2.md",
  "docs/LoopPilot_Quickstart.md",
  "docs/LoopPilot_Reusable_Artifacts_v1.md",
  "docs/LoopPilot_Implementation_Status_and_Plan_v0.2.md",
  "docs/release-checklist.md",
  "docs/release-notes-0.1.0.md",
];

const discoveredDocs = fs.existsSync("docs")
  ? fs.readdirSync("docs")
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join("docs", file))
  : [];

const filesToScan = [...new Set(["README.md", "IMPLEMENTATION_PROGRESS.md", ...requiredDocs, ...discoveredDocs])].sort();

const forbiddenFragments = [
  ".looppilot/vision.md",
  ".looppilot/state.md",
  ".looppilot/run-log.md",
  "0.0.0",
  "looppilot check \"",
  "Latest contract/report files are never written by default",
  "latest contract/report files",
  "默认仍不写 `.looppilot/latest-contract.md` 或 `.looppilot/latest-report.md`",
  "未引入外部 Ajv",
  "返回 403",
  "静态 parity",
];

const requiredFragmentsByFile = {
  "README.md": [
    "@looppilot/cli",
    "0.1.0",
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
  ],
  "IMPLEMENTATION_PROGRESS.md": [
    "0.1.0",
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "npm publish",
  ],
  "docs/LoopPilot_PRD_v0.2.md": [
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "save-vision",
  ],
  "docs/LoopPilot_Technical_Design_v0.2.md": [
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "looppilot save-review-gate",
    "No MVP command should be named `run`",
    "A `check` command is also not part of the current release-ready surface",
  ],
  "docs/LoopPilot_Quickstart.md": [
    "0.1.0",
    "save-review-gate",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
  ],
  "docs/LoopPilot_Reusable_Artifacts_v1.md": [
    ".looppilot/latest-review-gate.md",
    "looppilot save-vision",
    "looppilot save-state",
    "looppilot save-run-log",
  ],
  "docs/release-checklist.md": [
    "0.1.0",
    "`npm publish` has not been run",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
  ],
  "docs/release-notes-0.1.0.md": [
    "not been published to npm",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
  ],
};

const errors = [];

for (const file of filesToScan) {
  if (!fs.existsSync(file)) {
    errors.push(`${file}: missing`);
    continue;
  }

  const content = fs.readFileSync(file, "utf8");
  for (const fragment of forbiddenFragments) {
    if (content.includes(fragment)) errors.push(`${file}: contains stale fragment "${fragment}"`);
  }

  for (const fragment of requiredFragmentsByFile[file] ?? []) {
    if (!content.includes(fragment)) errors.push(`${file}: missing required fragment "${fragment}"`);
  }
}

if (errors.length > 0) {
  console.error("LoopPilot docs consistency validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot docs consistency validation passed.");
