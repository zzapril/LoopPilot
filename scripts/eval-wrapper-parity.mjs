#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateDecisionAgainstSchema } from "./lib/schema-validator.mjs";

const defaultEvalDir = "evals/wrapper-parity";

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: invalid JSON: ${error.message}`);
      }
    });
}

function byId(records, filePath) {
  const map = new Map();
  for (const record of records) {
    if (!record.id) throw new Error(`${filePath}: record is missing id`);
    if (map.has(record.id)) throw new Error(`${filePath}: duplicate id ${record.id}`);
    map.set(record.id, record);
  }
  return map;
}

function sortedStrings(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) return value;
  return [...value].sort();
}

export function normalizeWrapperOutput(output) {
  return {
    decision: output?.decision ?? null,
    recommended_surface: output?.recommended_surface ?? null,
    confidence: output?.confidence ?? null,
    needs_clarification: output?.needs_clarification ?? null,
    required_user_confirmation: sortedStrings(output?.required_user_confirmation),
    contract: output?.contract
      ? {
          surface_config: output.contract.surface_config ?? null,
          allowed_actions: sortedStrings(output.contract.allowed_actions),
          gate: output.contract.gate ?? null,
          stop_conditions: sortedStrings(output.contract.stop_conditions),
          forbidden_actions: sortedStrings(output.contract.forbidden_actions),
          human_confirmations: sortedStrings(output.contract.human_confirmations),
          report: sortedStrings(output.contract.report),
        }
      : null,
  };
}

function compareCapabilityAware(id, codexOutput, claudeOutput) {
  const errors = [];
  if (codexOutput?.recommended_surface !== claudeOutput?.recommended_surface) {
    errors.push(`${id}: capability-aware outputs must recommend the same surface`);
  }
  for (const [host, output] of [["codex", codexOutput], ["claude", claudeOutput]]) {
    if (output?.decision !== "RUN_WITH_CONTRACT") continue;
    if (!output.host_capabilities?.supported_surfaces?.includes(output.recommended_surface)) {
      errors.push(`${id}: ${host} RUN_WITH_CONTRACT surface is not supported by its host profile`);
    }
    if (output.contract?.surface_config?.type !== output.recommended_surface) {
      errors.push(`${id}: ${host} contract surface_config does not match recommended_surface`);
    }
    if (["loop", "routine"].includes(output.recommended_surface)) {
      if (!output.contract?.forbidden_actions?.includes("mutate_external_state")) {
        errors.push(`${id}: ${host} external surface does not forbid external mutation`);
      }
      for (const forbiddenAllowed of ["edit_small_scope", "run_test_command", "run_lint_command", "install_locked_dependencies"]) {
        if (output.contract?.allowed_actions?.includes(forbiddenAllowed)) {
          errors.push(`${id}: ${host} external surface allows ${forbiddenAllowed}`);
        }
      }
    }
  }
  if (codexOutput?.decision === "RUN_WITH_CONTRACT" && claudeOutput?.decision === "RUN_WITH_CONTRACT") {
    errors.push(...compareNormalized(
      `${id}: executable contracts`,
      normalizeWrapperOutput(codexOutput),
      normalizeWrapperOutput(claudeOutput),
    ));
  }
  return errors;
}

function outputFromRecord(record) {
  return record.output ?? record.expected_decision ?? record;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function compareNormalized(id, codex, claude) {
  const codexJson = stableJson(codex);
  const claudeJson = stableJson(claude);
  if (codexJson === claudeJson) return [];
  return [
    `${id}: normalized safety-critical fields diverged`,
    `  codex: ${JSON.stringify(codex)}`,
    `  claude: ${JSON.stringify(claude)}`,
  ];
}

export function evalWrapperParity(root = process.cwd(), options = {}) {
  const evalDir = options.evalDir ?? path.join(root, defaultEvalDir);
  const fixturePath = options.fixtures ?? path.join(evalDir, "fixtures.jsonl");
  const codexPath = options.codex ?? process.env.LOOPPILOT_CODEX_OUTPUTS ?? path.join(evalDir, "goldens/codex.jsonl");
  const claudePath = options.claude ?? process.env.LOOPPILOT_CLAUDE_OUTPUTS ?? path.join(evalDir, "goldens/claude.jsonl");

  const fixtures = readJsonl(fixturePath);
  const codex = byId(readJsonl(codexPath), codexPath);
  const claude = byId(readJsonl(claudePath), claudePath);
  const schema = JSON.parse(fs.readFileSync(path.join(root, ".looppilot/core/decision-schema.json"), "utf8"));
  const errors = [];
  const fixtureIds = new Set();
  for (const fixture of fixtures) {
    if (!fixture.id) errors.push(`${fixturePath}: parity fixture is missing id`);
    else if (fixtureIds.has(fixture.id)) errors.push(`${fixture.id}: duplicate parity fixture id`);
    else fixtureIds.add(fixture.id);
  }

  for (const fixture of fixtures) {
    if (!["strict", "capability_aware"].includes(fixture.parity_mode)) {
      errors.push(`${fixture.id}: unsupported parity_mode ${JSON.stringify(fixture.parity_mode)}`);
    }
    if (!codex.has(fixture.id)) errors.push(`${fixture.id}: missing Codex wrapper output`);
    if (!claude.has(fixture.id)) errors.push(`${fixture.id}: missing Claude wrapper output`);
    if (!codex.has(fixture.id) || !claude.has(fixture.id)) continue;

    const codexOutput = outputFromRecord(codex.get(fixture.id));
    const claudeOutput = outputFromRecord(claude.get(fixture.id));
    for (const [host, output] of [["codex", codexOutput], ["claude", claudeOutput]]) {
      errors.push(...validateDecisionAgainstSchema(output, schema, `${fixture.id}.${host}`).map(
        (error) => `${fixture.id}: invalid ${host} wrapper output: ${error}`,
      ));
    }
    if (fixture.parity_mode === "capability_aware") {
      errors.push(...compareCapabilityAware(fixture.id, codexOutput, claudeOutput));
    } else {
      errors.push(...compareNormalized(
        fixture.id,
        normalizeWrapperOutput(codexOutput),
        normalizeWrapperOutput(claudeOutput),
      ));
    }
  }

  for (const [host, outputs] of [["Codex", codex], ["Claude", claude]]) {
    for (const id of outputs.keys()) {
      if (!fixtureIds.has(id)) errors.push(`${id}: extra ${host} wrapper output has no parity fixture`);
    }
  }

  return { errors, fixtures: fixtures.length, codexPath, claudePath, fixturePath };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    const result = evalWrapperParity();
    if (result.errors.length > 0) {
      console.error("LoopPilot wrapper output parity eval failed:");
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log("LoopPilot wrapper output parity eval passed.");
      console.log(`Fixtures: ${result.fixtures}`);
      console.log(`Codex outputs: ${path.relative(process.cwd(), result.codexPath)}`);
      console.log(`Claude outputs: ${path.relative(process.cwd(), result.claudePath)}`);
    }
  } catch (error) {
    console.error(`LoopPilot wrapper output parity eval failed: ${error.message}`);
    process.exitCode = 1;
  }
}
