#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-npm-cache-"));
const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-pack-"));
const installDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-pack-install-"));
const errors = [];

function npmValidationEnv() {
  return {
    ...process.env,
    npm_config_cache: cacheDir,
    // `npm publish --dry-run` exports this flag to lifecycle scripts. This
    // validator must still create a real temporary tarball for local smoke tests.
    npm_config_dry_run: "false",
  };
}

const result = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], {
  encoding: "utf8",
  env: npmValidationEnv(),
});

if (result.status !== 0) {
  errors.push(`npm pack --json failed: ${result.stderr || result.stdout}`);
} else {
  try {
    const parsed = JSON.parse(result.stdout);
    const packedFileName = parsed[0]?.filename;
    const files = new Set((parsed[0]?.files ?? []).map((file) => file.path));
    const requiredFiles = [
      ".looppilot/core/qualification-rules.md",
      ".looppilot/core/decision-schema.json",
      ".looppilot/core/contract-template.md",
      ".looppilot/core/export-template-codex.md",
      ".looppilot/core/export-template-claude.md",
      ".looppilot/core/export-template-github-issue.md",
      ".looppilot/core/report-template.md",
      ".looppilot/core/vision-template.md",
      ".looppilot/core/state-template.md",
      ".looppilot/core/run-log-template.md",
      ".looppilot/core/review-gate-template.md",
      ".looppilot/fixtures/decision-fixtures.jsonl",
      ".looppilot/scripts/scan-summary.mjs",
      ".looppilot/scripts/claude-project-summary.mjs",
      ".looppilot/scripts/host-capability-summary.mjs",
      ".looppilot/scripts/issue-intake.mjs",
      ".agents/skills/looppilot/SKILL.md",
      ".claude/skills/looppilot/SKILL.md",
      ".claude/commands/should-loop.md",
      "scripts/looppilot.mjs",
      "scripts/validate-all.mjs",
      "scripts/validate-docs-consistency.mjs",
      "scripts/validate-issue-intake.mjs",
      "scripts/validate-package-contents.mjs",
      "scripts/lib/decision-validator.mjs",
      "scripts/lib/schema-validator.mjs",
      "scripts/lib/wrapper-validator.mjs",
      "docs/README.md",
      "docs/LoopPilot_Quickstart.md",
      "docs/LoopPilot_PRD_v0.2.md",
      "docs/LoopPilot_Technical_Design_v0.2.md",
      "docs/LoopPilot_Reusable_Artifacts_v1.md",
      "docs/release-checklist.md",
      "docs/release-notes-0.1.0.md",
      "docs/release-notes-0.2.0.md",
      "docs/release-notes-0.2.1.md",
      "IMPLEMENTATION_PROGRESS.md",
      "README.md",
      "LICENSE",
      "package.json",
    ];
    const forbiddenPrefixes = [
      ".looppilot/exports/",
      ".looppilot/latest-",
    ];
    const forbiddenFiles = [
      ".looppilot/latest-contract.md",
      ".looppilot/latest-report.md",
      ".looppilot/latest-review-gate.md",
      ".looppilot/VISION.md",
      ".looppilot/STATE.md",
      ".looppilot/RUN_LOG.md",
    ];

    for (const file of requiredFiles) {
      if (!files.has(file)) errors.push(`package contents missing ${file}`);
    }
    for (const file of files) {
      if (forbiddenFiles.includes(file)) errors.push(`package contents included generated file ${file}`);
      if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
        errors.push(`package contents included forbidden path ${file}`);
      }
    }

    if (!packedFileName) {
      errors.push("npm pack did not report a tarball filename");
    } else {
      const tarballPath = path.join(packDir, packedFileName);
      const npmInstall = spawnSync("npm", ["install", tarballPath, "--ignore-scripts", "--no-audit", "--no-fund"], {
        cwd: installDir,
        encoding: "utf8",
        env: npmValidationEnv(),
      });
      if (npmInstall.status !== 0) {
        errors.push(`packed package local install failed: ${npmInstall.stderr || npmInstall.stdout}`);
      } else {
        const installedPackageDir = path.join(installDir, "node_modules", "@looppilot", "cli");
        const binName = process.platform === "win32" ? "looppilot.cmd" : "looppilot";
        const binPath = path.join(installDir, "node_modules", ".bin", binName);
        const installedHelp = spawnSync(binPath, ["--help"], {
          cwd: installDir,
          encoding: "utf8",
        });
        if (installedHelp.status !== 0 || !installedHelp.stdout.includes("Usage:")) {
          errors.push(`installed package bin help failed: ${installedHelp.stderr || installedHelp.stdout}`);
        }

        const scriptHelp = spawnSync(process.execPath, ["scripts/looppilot.mjs", "--help"], {
          cwd: installedPackageDir,
          encoding: "utf8",
        });
        if (scriptHelp.status !== 0 || !scriptHelp.stdout.includes("Usage:")) {
          errors.push(`installed package CLI help failed: ${scriptHelp.stderr || scriptHelp.stdout}`);
        }

        const advancedHelp = spawnSync(process.execPath, ["scripts/looppilot.mjs", "help", "advanced"], {
          cwd: installedPackageDir,
          encoding: "utf8",
        });
        if (advancedHelp.status !== 0 || !advancedHelp.stdout.includes("looppilot issue-intake --url")) {
          errors.push(`installed package CLI advanced help failed: ${advancedHelp.stderr || advancedHelp.stdout}`);
        }

        const doctor = spawnSync(process.execPath, ["scripts/looppilot.mjs", "doctor", "--target", "both", "--json"], {
          cwd: installedPackageDir,
          encoding: "utf8",
        });
        if (doctor.status !== 0) {
          errors.push(`installed package CLI doctor failed: ${doctor.stderr || doctor.stdout}`);
        } else {
          try {
            const report = JSON.parse(doctor.stdout);
            if (!report.ok) errors.push("installed package CLI doctor report was not ok");
          } catch (error) {
            errors.push(`installed package CLI doctor output was not JSON: ${error.message}`);
          }
        }

        const install = spawnSync(process.execPath, ["scripts/looppilot.mjs", "install", "--dry-run"], {
          cwd: installedPackageDir,
          encoding: "utf8",
        });
        if (install.status !== 0 || !install.stdout.includes("LoopPilot install completed.")) {
          errors.push(`installed package CLI install dry-run failed: ${install.stderr || install.stdout}`);
        }
      }
    }
  } catch (error) {
    errors.push(`npm pack --json output was not JSON: ${error.message}`);
  }
}

fs.rmSync(cacheDir, { recursive: true, force: true });
fs.rmSync(packDir, { recursive: true, force: true });
fs.rmSync(installDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot package contents validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot package contents validation passed.");
