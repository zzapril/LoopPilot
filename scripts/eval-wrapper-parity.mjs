#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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
    confidence: output?.confidence ?? null,
    needs_clarification: output?.needs_clarification ?? null,
    contract: output?.contract
      ? {
          gate: output.contract.gate ?? null,
          stop_conditions: sortedStrings(output.contract.stop_conditions),
          forbidden_actions: sortedStrings(output.contract.forbidden_actions),
        }
      : null,
  };
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
  const errors = [];

  for (const fixture of fixtures) {
    if (!codex.has(fixture.id)) errors.push(`${fixture.id}: missing Codex wrapper output`);
    if (!claude.has(fixture.id)) errors.push(`${fixture.id}: missing Claude wrapper output`);
    if (!codex.has(fixture.id) || !claude.has(fixture.id)) continue;

    errors.push(
      ...compareNormalized(
        fixture.id,
        normalizeWrapperOutput(outputFromRecord(codex.get(fixture.id))),
        normalizeWrapperOutput(outputFromRecord(claude.get(fixture.id))),
      ),
    );
  }

  return { errors, fixtures: fixtures.length, codexPath, claudePath, fixturePath };
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  const result = evalWrapperParity();
  if (result.errors.length > 0) {
    console.error("LoopPilot wrapper output parity eval failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("LoopPilot wrapper output parity eval passed.");
  console.log(`Fixtures: ${result.fixtures}`);
  console.log(`Codex outputs: ${path.relative(process.cwd(), result.codexPath)}`);
  console.log(`Claude outputs: ${path.relative(process.cwd(), result.claudePath)}`);
}
