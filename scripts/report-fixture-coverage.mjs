#!/usr/bin/env node
import { readJsonlFile } from "./lib/decision-validator.mjs";

const fixturePath = ".looppilot/fixtures/decision-fixtures.jsonl";
const fixtures = readJsonlFile(fixturePath);

const riskKeywords = [
  "auth",
  "payment",
  "billing",
  "checkout",
  "permission",
  "admin",
  "production",
  "deploy",
  "publish",
  "delete",
  "drop",
  "migration",
  "secret",
  "token",
  "credential",
  "支付",
  "账单",
  "鉴权",
  "权限",
  "生产",
  "部署",
  "删除",
  "迁移",
  "密钥",
  "凭证",
];

const taxonomyMatrix = [
  {
    category: "unknown_host",
    minExamples: 2,
    pattern: /"host":"unknown"|"capability_confidence":"unknown"/i,
    // Unknown hosts may lack edit, command, approval, or skill support, so LoopPilot must fall back to planning instead of automated execution.
    safetyRationale: "Unknown host capabilities force PLAN_ONLY because execution guarantees cannot be verified.",
  },
  {
    category: "dependency_install",
    minExamples: 2,
    pattern: /dependenc|install/i,
    // Dependency installs can run arbitrary lifecycle scripts and change the trusted execution surface for every later loop round.
    safetyRationale: "Dependency changes need human confirmation before a loop may alter or execute the environment.",
  },
  {
    category: "destructive_operation",
    minExamples: 2,
    pattern: /delete|drop|remove|destructive|删除|清空/i,
    // Destructive actions can erase code, data, or evidence that a bounded gate cannot reliably reconstruct.
    safetyRationale: "Deletion and drop-style tasks must not be hidden inside an autonomous repair loop.",
  },
  {
    category: "auth_or_permission",
    minExamples: 2,
    pattern: /auth|login|signup|permission|admin|鉴权|权限|管理员/i,
    // Auth and permission edits can grant access, lock users out, or weaken account boundaries.
    safetyRationale: "Identity and authorization work requires review beyond a passing local command.",
  },
  {
    category: "payment_or_billing",
    minExamples: 2,
    pattern: /payment|billing|revenue|checkout|支付|账单|结账/i,
    // Payment and billing logic has financial, compliance, and customer-impact risk.
    safetyRationale: "Financial workflows are high risk even when a local test gate exists.",
  },
  {
    category: "production_or_deploy",
    minExamples: 2,
    pattern: /production|deploy|publish|发布|部署|生产/i,
    // Production, deploy, and publish actions affect live users or distributed artifacts outside the repo sandbox.
    safetyRationale: "External release actions are outside v0 loop execution boundaries.",
  },
  {
    category: "secrets_or_credentials",
    minExamples: 2,
    pattern: /secret|token|credential|\.env|密钥|凭证/i,
    // Secrets and credentials must not be read, transformed, or exposed through logs and loop reports.
    safetyRationale: "Secret-handling tasks need human-owned procedures instead of automated edits.",
  },
  {
    category: "commit_or_push",
    minExamples: 2,
    pattern: /commit|push/i,
    // Commit and push operations publish agent output into durable history or remote systems before review.
    safetyRationale: "Version-control publication must be a deliberate human-approved boundary.",
  },
  {
    category: "migration_or_database",
    minExamples: 2,
    pattern: /migration|migrate|database|schema|迁移|数据库/i,
    // Migrations and database work can cause persistent data loss or irreversible schema drift.
    safetyRationale: "Database-affecting work needs rollback planning and review before execution.",
  },
  {
    category: "missing_or_weak_gate",
    minExamples: 2,
    pattern: /no objective|no safe local|not objective|unknown command|do not know the command|no test command/i,
    // LoopPilot depends on objective local gates; weak gates let loops keep editing without proof of success.
    safetyRationale: "A loop without a deterministic gate is not bounded or auditable.",
  },
];

const taxonomy = Object.fromEntries(taxonomyMatrix.map(({ category, pattern }) => [category, pattern]));

const requiredTaxonomy = taxonomyMatrix.map(({ category }) => category);

const counts = { NO_GO: 0, PLAN_ONLY: 0, RUN_WITH_CONTRACT: 0 };
const riskCoverage = Object.fromEntries(riskKeywords.map((keyword) => [keyword, 0]));
const taxonomyCoverage = Object.fromEntries(Object.keys(taxonomy).map((category) => [category, 0]));
const errors = [];

function textForFixture(fixture) {
  return JSON.stringify({
    user_goal: fixture.user_goal,
    repo_summary: fixture.repo_summary,
    reasons: fixture.expected_decision?.reasons,
    safe_alternative: fixture.expected_decision?.safe_alternative,
    plan_outputs: fixture.expected_decision?.plan_outputs,
    required_user_confirmation: fixture.expected_decision?.required_user_confirmation,
    host_capabilities: fixture.expected_decision?.host_capabilities,
  }).toLowerCase();
}

for (const fixture of fixtures) {
  counts[fixture.category] = (counts[fixture.category] ?? 0) + 1;
  const text = textForFixture(fixture);
  for (const keyword of riskKeywords) {
    if (text.includes(keyword.toLowerCase())) riskCoverage[keyword] += 1;
  }
  for (const [category, pattern] of Object.entries(taxonomy)) {
    if (pattern.test(text)) taxonomyCoverage[category] += 1;
  }

  const decision = fixture.expected_decision;
  const highRisk = taxonomy.payment_or_billing.test(text)
    || taxonomy.production_or_deploy.test(text)
    || taxonomy.secrets_or_credentials.test(text)
    || taxonomy.auth_or_permission.test(text);
  if (highRisk && decision.decision === "RUN_WITH_CONTRACT") {
    errors.push(`${fixture.id}: high-risk fixture must not RUN_WITH_CONTRACT`);
  }

  if (decision.decision === "RUN_WITH_CONTRACT") {
    if (!decision.contract?.gate) errors.push(`${fixture.id}: RUN_WITH_CONTRACT missing gate`);
    if (!decision.contract?.stop_conditions?.length) errors.push(`${fixture.id}: RUN_WITH_CONTRACT missing stop conditions`);
    if (decision.host_capabilities?.capability_confidence !== "known") {
      errors.push(`${fixture.id}: RUN_WITH_CONTRACT missing known host capabilities`);
    }
  }
}

const coveredRisks = Object.entries(riskCoverage).filter(([, count]) => count > 0);
const undercoveredTaxonomy = taxonomyMatrix.filter(({ category, minExamples }) => taxonomyCoverage[category] < minExamples);
const summary = {
  total: fixtures.length,
  decisions: counts,
  covered_risk_keywords: Object.fromEntries(coveredRisks),
  covered_risk_keyword_count: coveredRisks.length,
  taxonomy: taxonomyCoverage,
};

if (coveredRisks.length < 10) errors.push("risk keyword coverage is too low; expected at least 10 covered keywords");
if (undercoveredTaxonomy.length > 0) {
  errors.push(
    `missing required taxonomy coverage: ${undercoveredTaxonomy
      .map(({ category, minExamples }) => `${category} (${taxonomyCoverage[category]}/${minExamples})`)
      .join(", ")}`,
  );
}

if (errors.length > 0) {
  console.error("LoopPilot fixture coverage validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log("LoopPilot fixture coverage validation passed.");
console.log(JSON.stringify(summary, null, 2));
