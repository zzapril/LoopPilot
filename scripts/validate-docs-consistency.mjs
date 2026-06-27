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
  "docs/release-notes-0.2.0.md",
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
  "解包并 smoke test",
  "not been published to npm",
  "`npm publish` has not been run",
  "npm publish` still requires npm authentication",
  "Until the package is published",
  "After human approval and npm publish",
];

const requiredFragmentsByFile = {
  "README.md": [
    "@looppilot/cli",
    "0.1.0",
    "0.2.0",
    "issue-intake",
    ".looppilot/scripts/issue-intake.mjs",
    "--cwd /path/to/your/project",
    "possibly_incomplete",
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
  ],
  "IMPLEMENTATION_PROGRESS.md": [
    "0.1.0",
    "0.2.0",
    "issue-intake",
    ".looppilot/scripts/issue-intake.mjs",
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "published to npm",
  ],
  "docs/LoopPilot_PRD_v0.2.md": [
    "single issue intake",
    ".looppilot/latest-review-gate.md",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "save-vision",
  ],
  "docs/LoopPilot_Technical_Design_v0.2.md": [
    "looppilot issue-intake",
    "possibly_incomplete",
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
    "0.2.0",
    "issue-intake",
    "--cwd /path/to/your/project",
    "possibly_incomplete",
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
    "0.2.0",
    ".looppilot/scripts/issue-intake.mjs",
    "https://www.npmjs.com/package/@looppilot/cli",
    "611c591fa361bf9a1bb4209fd028b8e842eb017a",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "Smoke-test Claude Code `/should-loop`",
  ],
  "docs/release-notes-0.1.0.md": [
    "published to npm",
    "https://www.npmjs.com/package/@looppilot/cli",
    "611c591fa361bf9a1bb4209fd028b8e842eb017a",
    ".looppilot/VISION.md",
    ".looppilot/STATE.md",
    ".looppilot/RUN_LOG.md",
    "Claude Code `2.1.168`",
  ],
  "docs/release-notes-0.2.0.md": [
    "release-ready",
    "@looppilot/cli@0.2.0",
    "@looppilot/cli@0.1.0",
    ".looppilot/scripts/issue-intake.mjs",
    "possibly_incomplete",
    "npm publish",
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
