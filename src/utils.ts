import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { LockfileGuardianConfig, LockfileInfo, PackageManager } from "./types";

export const PACKAGE_MANAGERS: PackageManager[] = [
  { name: "pnpm", lockFile: "pnpm-lock.yaml", installCommand: "pnpm install" },
  { name: "yarn", lockFile: "yarn.lock", installCommand: "yarn install" },
  { name: "npm", lockFile: "package-lock.json", installCommand: "npm install" },
];

export function createSHA256Hash(filePath: string): string {
  const content = readFileSync(filePath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

export function findLockfile(cwd: string = process.cwd()): LockfileInfo | null {
  for (const pm of PACKAGE_MANAGERS) {
    const lockfilePath = resolve(cwd, pm.lockFile);
    if (existsSync(lockfilePath)) {
      const hash = createSHA256Hash(lockfilePath);
      return {
        path: lockfilePath,
        packageManager: pm,
        hash,
      };
    }
  }
  return null;
}

export function findGitRoot(cwd: string = process.cwd()): string | null {
  let currentDir = resolve(cwd);
  const root = resolve("/");

  while (currentDir !== root) {
    const gitDir = join(currentDir, ".git");
    try {
      if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
        return currentDir;
      }
    } catch {
      // Continue searching
    }
    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

export function isGitRepository(cwd: string = process.cwd()): boolean {
  return findGitRoot(cwd) !== null;
}

export function getGitHooksDir(cwd: string = process.cwd()): string {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }
  return join(gitRoot, ".git", "hooks");
}

export function getHuskyHooksDir(cwd: string = process.cwd()): string {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }
  return join(gitRoot, ".husky");
}

export function getGitHooksPath(cwd: string = process.cwd()): string {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }

  try {
    const { execSync } = require("child_process");
    const result = execSync("git config --get core.hooksPath", {
      cwd: gitRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return resolve(gitRoot, result.trim());
  } catch {
    // No custom hooks path set, use default
    return getGitHooksDir(cwd);
  }
}

export function isHuskyProject(cwd: string = process.cwd()): boolean {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    return false;
  }

  // Check if .husky directory exists
  const huskyDir = getHuskyHooksDir(cwd);
  if (!existsSync(huskyDir)) {
    return false;
  }

  // Check if core.hooksPath is set to .husky
  try {
    const { execSync } = require("child_process");
    const hooksPath = execSync("git config --get core.hooksPath", {
      cwd: gitRoot,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    const resolvedHooksPath = resolve(gitRoot, hooksPath);
    const resolvedHuskyDir = resolve(gitRoot, ".husky");

    return resolvedHooksPath === resolvedHuskyDir;
  } catch {
    return false;
  }
}

export function getActiveHooksDir(cwd: string = process.cwd()): string {
  if (isHuskyProject(cwd)) {
    return getHuskyHooksDir(cwd);
  }
  return getGitHooksPath(cwd);
}

export function getGuardianDataPath(cwd: string = process.cwd()): string {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not in a git repository");
  }

  // For backward compatibility, if we're at the git root, use the old path
  if (resolve(cwd) === resolve(gitRoot)) {
    return join(gitRoot, ".git", "lockfile-guardian");
  }

  // Create a unique path for each project in monorepos
  const relativePath = resolve(cwd)
    .replace(resolve(gitRoot), "")
    .replace(/^\//, "");
  const safePath = relativePath.replace(/[^a-zA-Z0-9-_]/g, "_");

  return join(gitRoot, ".git", "lockfile-guardian", safePath);
}

export function loadConfig(
  cwd: string = process.cwd()
): LockfileGuardianConfig {
  const packageJsonPath = join(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    return { checkNodeModules: true };
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return {
      checkNodeModules: true,
      ...packageJson.lockfileGuardian,
    };
  } catch {
    return { checkNodeModules: true };
  }
}

export function isNodeModulesIgnored(cwd: string = process.cwd()): boolean {
  const gitignorePath = join(cwd, ".gitignore");

  if (!existsSync(gitignorePath)) {
    return false;
  }

  try {
    const gitignoreContent = readFileSync(gitignorePath, "utf8");
    return gitignoreContent.includes("node_modules");
  } catch {
    return false;
  }
}

export function log(message: string, silent: boolean = false): void {
  if (!silent) {
    console.log(message);
  }
}

export function logWarning(message: string): void {
  console.log(message);
}

export function logError(message: string): void {
  console.error(message);
}
