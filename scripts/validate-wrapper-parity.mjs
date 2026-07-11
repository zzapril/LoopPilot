#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evalWrapperParity } from "./eval-wrapper-parity.mjs";
import { validateWrapperParity } from "./lib/wrapper-parity.mjs";

export { validateWrapperParity } from "./lib/wrapper-parity.mjs";

function validateEvalParityGuardrails(root = process.cwd()) {
  const errors = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-parity-guardrails-"));
  const sourceDir = path.join(root, "evals", "wrapper-parity");
  try {
    // Published runtime packs do not ship source-repository eval goldens.
    // The local repository runs these mutation probes as part of npm test.
    if (!fs.existsSync(sourceDir)) return errors;
    fs.cpSync(sourceDir, tempDir, { recursive: true });
    const options = {
      evalDir: tempDir,
      fixtures: path.join(tempDir, "fixtures.jsonl"),
      codex: path.join(tempDir, "goldens", "codex.jsonl"),
      claude: path.join(tempDir, "goldens", "claude.jsonl"),
    };
    if (evalWrapperParity(root, options).errors.length > 0) {
      errors.push("wrapper parity baseline unexpectedly failed during guardrail probes");
      return errors;
    }

    fs.appendFileSync(options.codex, `${JSON.stringify({ id: "extra-output", output: {} })}\n`, "utf8");
    if (!evalWrapperParity(root, options).errors.some((error) => error.includes("extra Codex wrapper output"))) {
      errors.push("wrapper parity eval did not reject an extra golden output");
    }

    fs.copyFileSync(path.join(sourceDir, "goldens", "codex.jsonl"), options.codex);
    const fixtureLines = fs.readFileSync(options.fixtures, "utf8").trim().split(/\n/).map(JSON.parse);
    fixtureLines[0].parity_mode = "typo_mode";
    fs.writeFileSync(options.fixtures, `${fixtureLines.map(JSON.stringify).join("\n")}\n`, "utf8");
    if (!evalWrapperParity(root, options).errors.some((error) => error.includes("unsupported parity_mode"))) {
      errors.push("wrapper parity eval did not reject an unsupported parity mode");
    }

    fs.copyFileSync(path.join(sourceDir, "fixtures.jsonl"), options.fixtures);
    const duplicateFixture = fs.readFileSync(options.fixtures, "utf8").trim().split(/\n/)[0];
    fs.appendFileSync(options.fixtures, `${duplicateFixture}\n`, "utf8");
    if (!evalWrapperParity(root, options).errors.some((error) => error.includes("duplicate parity fixture id"))) {
      errors.push("wrapper parity eval did not reject a duplicate fixture id");
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return errors;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const result = validateWrapperParity();
  result.errors.push(...validateEvalParityGuardrails());
  if (result.errors.length > 0) {
    console.error("LoopPilot wrapper parity validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("LoopPilot wrapper parity validation passed.");
  console.log(`Workflow steps: ${result.workflowSteps}`);
  console.log(`Guardrails checked: ${result.guardrails}`);
}
