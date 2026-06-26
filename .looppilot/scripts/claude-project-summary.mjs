#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const projectSettingsFiles = [
  ".claude/settings.json",
  ".claude/settings.local.json",
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJsonObject(relativePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasOwnObjectKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
    && object[key]
    && typeof object[key] === "object"
    && !Array.isArray(object[key]);
}

const settingsMetadata = projectSettingsFiles
  .filter(exists)
  .map((relativePath) => {
    const settings = readJsonObject(relativePath);
    return {
      path: relativePath,
      readable_json: Boolean(settings),
      has_permissions: Boolean(settings && hasOwnObjectKey(settings, "permissions")),
      has_hooks: Boolean(settings && hasOwnObjectKey(settings, "hooks")),
    };
  });

const summary = {
  claude_wrapper_exists: exists(".claude/skills/looppilot/SKILL.md"),
  command_alias_exists: exists(".claude/commands/should-loop.md"),
  project_permission_metadata_present: settingsMetadata.some((file) => file.has_permissions),
  project_hook_metadata_present: settingsMetadata.some((file) => file.has_hooks),
  inspected_project_settings_files: settingsMetadata,
};

console.log(JSON.stringify(summary, null, 2));
