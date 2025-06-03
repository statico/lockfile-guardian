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

export function isGitRepository(cwd: string = process.cwd()): boolean {
  const gitDir = join(cwd, ".git");
  try {
    return existsSync(gitDir) && statSync(gitDir).isDirectory();
  } catch {
    return false;
  }
}

export function getGitHooksDir(cwd: string = process.cwd()): string {
  return join(cwd, ".git", "hooks");
}

export function getHuskyHooksDir(cwd: string = process.cwd()): string {
  return join(cwd, ".husky");
}

export function getGitHooksPath(cwd: string = process.cwd()): string {
  try {
    const { execSync } = require("child_process");
    const result = execSync("git config --get core.hooksPath", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
    return resolve(cwd, result.trim());
  } catch {
    // No custom hooks path set, use default
    return getGitHooksDir(cwd);
  }
}

export function isHuskyProject(cwd: string = process.cwd()): boolean {
  // Check if .husky directory exists
  const huskyDir = getHuskyHooksDir(cwd);
  if (!existsSync(huskyDir)) {
    return false;
  }

  // Check if core.hooksPath is set to .husky
  try {
    const { execSync } = require("child_process");
    const hooksPath = execSync("git config --get core.hooksPath", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();

    const resolvedHooksPath = resolve(cwd, hooksPath);
    const resolvedHuskyDir = resolve(cwd, ".husky");

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
  return join(cwd, ".git", "lockfile-guardian");
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
