import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEPENDENCY_METADATA = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "deno.lock",
]);

export function isInsideProject(targetRoot, candidatePath) {
  const relative = path.relative(targetRoot, candidatePath);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function isProtectedPackPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/").toLowerCase();
  return normalized.startsWith(".looppilot/core/")
    || normalized.startsWith(".looppilot/fixtures/")
    || normalized.startsWith(".looppilot/scripts/")
    || normalized.startsWith(".agents/skills/looppilot/")
    || normalized.startsWith(".claude/skills/looppilot/")
    || normalized === ".claude/commands/should-loop.md";
}

export function isDependencyMetadataPath(candidatePath) {
  const basename = candidatePath.split(path.sep).pop()?.toLowerCase() ?? "";
  return DEPENDENCY_METADATA.has(basename);
}

export function isSensitivePath(candidatePath) {
  const normalized = candidatePath.split(path.sep).join("/").toLowerCase();
  const segments = normalized.split("/").filter(Boolean);
  const basename = segments.at(-1) ?? "";
  return /^\.env(?:\..*)?$/.test(basename)
    || [".npmrc", ".pypirc", ".netrc"].includes(basename)
    || /\.(?:pem|key)$/.test(basename)
    || segments.some((segment) => ["secrets", ".ssh", ".aws"].includes(segment))
    || normalized.endsWith("/.docker/config.json")
    || normalized.endsWith("/.config/gh/hosts.yml");
}

export function assertSafeProjectPath(targetRoot, destination, relativePath, operation = "install") {
  const relative = path.relative(targetRoot, destination);
  if (!isInsideProject(targetRoot, destination)) {
    throw new Error(`${relativePath} resolves outside the project root.`);
  }

  let current = targetRoot;
  const parts = relative.split(path.sep).filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      const component = path.relative(targetRoot, current) || ".";
      throw new Error(`${relativePath} uses symbolic link path component ${component}; ${operation} refuses paths that can escape the project.`);
    }
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`${relativePath} cannot be used because ${path.relative(targetRoot, current)} is not a directory.`);
    }
  }
}

export function assertSafeOutputDestination(targetRoot, outputPath, operation) {
  const relative = path.relative(targetRoot, outputPath);
  if (isInsideProject(targetRoot, outputPath)) {
    assertSafeProjectPath(targetRoot, outputPath, relative || ".", operation);
    if (isProtectedPackPath(relative)) {
      throw new Error(`${operation} refuses to overwrite Agent Pack file ${relative}.`);
    }
  }
  if (isDependencyMetadataPath(outputPath)) {
    throw new Error(`${operation} refuses to overwrite dependency metadata ${outputPath}.`);
  }
  if (isSensitivePath(outputPath)) {
    throw new Error(`${operation} refuses to write a sensitive path ${outputPath}.`);
  }
  try {
    const stat = fs.lstatSync(outputPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`${operation} output must be a regular file, not a symbolic link or directory: ${outputPath}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function copyFileAtomically(source, destination) {
  const temporaryPath = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.looppilot-${process.pid}-${crypto.randomUUID()}.tmp`,
  );
  let displacedPath = null;
  let replacementSucceeded = false;
  try {
    fs.copyFileSync(source, temporaryPath);
    try {
      fs.renameSync(temporaryPath, destination);
    } catch (error) {
      if (!fs.existsSync(destination) || !["EEXIST", "EPERM"].includes(error.code)) throw error;
      displacedPath = path.join(
        path.dirname(destination),
        `.${path.basename(destination)}.looppilot-${process.pid}-${crypto.randomUUID()}.old`,
      );
      fs.renameSync(destination, displacedPath);
      try {
        fs.renameSync(temporaryPath, destination);
        replacementSucceeded = true;
      } catch (replacementError) {
        try {
          fs.renameSync(displacedPath, destination);
          displacedPath = null;
        } catch (restoreError) {
          throw new Error(`Replacement failed and the original file was preserved at ${displacedPath}: ${restoreError.message}`, { cause: replacementError });
        }
        throw replacementError;
      }
    }
  } finally {
    fs.rmSync(temporaryPath, { force: true });
    if (replacementSucceeded && displacedPath) fs.rmSync(displacedPath, { force: true });
  }
}

export function writeTextAtomically(destination, content) {
  const stagingPath = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.looppilot-${process.pid}-${crypto.randomUUID()}.write`,
  );
  try {
    fs.writeFileSync(stagingPath, content, "utf8");
    copyFileAtomically(stagingPath, destination);
  } finally {
    fs.rmSync(stagingPath, { force: true });
  }
}
