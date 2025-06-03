import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { spawn } from "child_process";
import {
  findLockfile,
  getGuardianDataPath,
  loadConfig,
  isNodeModulesIgnored,
  log,
  logWarning,
  logError,
} from "./utils";

export function storeCurrentHash(cwd: string = process.cwd()): void {
  const lockfileInfo = findLockfile(cwd);

  if (!lockfileInfo) {
    return; // No lockfile found
  }

  const dataPath = getGuardianDataPath(cwd);
  writeFileSync(dataPath, lockfileInfo.hash, "utf8");
}

export function getStoredHash(cwd: string = process.cwd()): string | null {
  const dataPath = getGuardianDataPath(cwd);

  if (!existsSync(dataPath)) {
    return null;
  }

  try {
    return readFileSync(dataPath, "utf8").trim();
  } catch {
    return null;
  }
}

export function clearStoredHash(cwd: string = process.cwd()): void {
  const dataPath = getGuardianDataPath(cwd);

  if (existsSync(dataPath)) {
    unlinkSync(dataPath);
  }
}

function createWarningBox(
  lockfileName: string,
  installCommand: string
): string {
  const separator = "=====================================";
  return [
    separator,
    "⚠️  DEPENDENCIES OUT OF DATE  ⚠️",
    separator,
    `Lock file ${lockfileName} has changed!`,
    "",
    "Run this command to update:",
    `  ${installCommand}`,
    separator,
  ].join("\n");
}

function runInstallCommand(command: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(" ");
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", () => {
      resolve(false);
    });
  });
}

export async function checkLockfile(
  isHook: boolean = false,
  cwd: string = process.cwd()
): Promise<void> {
  const config = loadConfig(cwd);
  const lockfileInfo = findLockfile(cwd);

  if (!lockfileInfo) {
    if (!isHook) {
      logError(
        "No lockfile found. Supported lockfiles: pnpm-lock.yaml, yarn.lock, package-lock.json"
      );
    }
    return;
  }

  // Check node_modules gitignore
  if (config.checkNodeModules && !isNodeModulesIgnored(cwd)) {
    logWarning("⚠️  Warning: node_modules is not in .gitignore");
  }

  const storedHash = getStoredHash(cwd);
  const currentHash = lockfileInfo.hash;

  // First run or no stored hash
  if (!storedHash) {
    storeCurrentHash(cwd);
    log("🔒 Lockfile Guardian initialized", config.silent);
    return;
  }

  // No changes detected
  if (storedHash === currentHash) {
    if (!isHook) {
      log("✅ Dependencies are up to date", config.silent);
    }
    return;
  }

  // Changes detected!
  const lockfileName = lockfileInfo.packageManager.lockFile;
  const installCommand = lockfileInfo.packageManager.installCommand;

  if (config.autoInstall) {
    log(`🔒 Lock file ${lockfileName} has changed!`, config.silent);
    log(
      `🔒 Auto-installing dependencies with ${lockfileInfo.packageManager.name}...`,
      config.silent
    );

    const success = await runInstallCommand(installCommand, cwd);

    if (success) {
      log("🔒 Dependencies updated successfully!", config.silent);
      storeCurrentHash(cwd);
    } else {
      logError("🔒 Failed to install dependencies. Please run manually:");
      logError(`  ${installCommand}`);
    }
  } else {
    // Show warning
    const warningMessage = createWarningBox(lockfileName, installCommand);
    logWarning(warningMessage);
  }
}
