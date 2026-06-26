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

const taxonomy = {
  unknown_host: /"host":"unknown"|"capability_confidence":"unknown"/i,
  dependency_install: /dependenc|install/i,
  destructive_operation: /delete|drop|remove|destructive|删除|清空/i,
  auth_or_permission: /auth|login|signup|permission|admin|鉴权|权限|管理员/i,
  payment_or_billing: /payment|billing|revenue|checkout|支付|账单|结账/i,
  production_or_deploy: /production|deploy|publish|发布|部署|生产/i,
  secrets_or_credentials: /secret|token|credential|\.env|密钥|凭证/i,
  commit_or_push: /commit|push/i,
  migration_or_database: /migration|migrate|database|schema|迁移|数据库/i,
  missing_or_weak_gate: /no objective|no safe local|not objective|unknown command|do not know the command|no test command/i,
};

const requiredTaxonomy = [
  "unknown_host",
  "dependency_install",
  "destructive_operation",
  "auth_or_permission",
  "payment_or_billing",
  "production_or_deploy",
  "secrets_or_credentials",
  "commit_or_push",
  "migration_or_database",
  "missing_or_weak_gate",
];

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
const uncoveredTaxonomy = requiredTaxonomy.filter((category) => taxonomyCoverage[category] === 0);
const summary = {
  total: fixtures.length,
  decisions: counts,
  covered_risk_keywords: Object.fromEntries(coveredRisks),
  covered_risk_keyword_count: coveredRisks.length,
  taxonomy: taxonomyCoverage,
};

if (coveredRisks.length < 10) errors.push("risk keyword coverage is too low; expected at least 10 covered keywords");
if (uncoveredTaxonomy.length > 0) errors.push(`missing required taxonomy coverage: ${uncoveredTaxonomy.join(", ")}`);

if (errors.length > 0) {
  console.error("LoopPilot fixture coverage validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log("LoopPilot fixture coverage validation passed.");
console.log(JSON.stringify(summary, null, 2));
