#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  installGitHooks,
  uninstallGitHooks,
  areHooksInstalled,
} from "./git-hooks";
import { checkLockfile, clearStoredHash } from "./guardian";
import {
  findLockfile,
  loadConfig,
  isGitRepository,
  log,
  logError,
  PACKAGE_MANAGERS,
} from "./utils";

interface CliArgs {
  command?: string;
  isHook?: boolean;
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--hook") {
      result.isHook = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (!result.command && !arg.startsWith("--")) {
      result.command = arg;
    }
  }

  return result;
}

function getVersion(): string {
  try {
    const packageJsonPath = join(__dirname, "..", "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      return packageJson.version || "1.0.0";
    }
  } catch {
    // Fallback if package.json can't be read
  }
  return "1.0.0";
}

function showHelp(): void {
  const version = getVersion();

  console.log(`
🔒 Lockfile Guardian v${version}

Never forget to install dependencies again! Automatically detect when your
lock files change after git operations and warn you (or auto-install) when
your dependencies are out of sync.

USAGE:
  npx lockfile-guardian [command]

COMMANDS:
  install     Setup git hooks (one-time setup)
  uninstall   Remove all hooks and cleanup
  check       Manually check for lock file changes
  help        Show this help message

EXAMPLES:
  npx lockfile-guardian install      # Setup git hooks
  npx lockfile-guardian check        # Check dependencies manually
  npx lockfile-guardian uninstall    # Remove all hooks

CONFIGURATION:
Add optional configuration to your package.json:

{
  "lockfileGuardian": {
    "autoInstall": true,       // Automatically run install commands
    "silent": false,           // Suppress non-warning output
    "checkNodeModules": true   // Warn if node_modules isn't gitignored
  }
}

SUPPORTED PACKAGE MANAGERS:
  • pnpm     - pnpm-lock.yaml → pnpm install
  • yarn     - yarn.lock → yarn install
  • npm      - package-lock.json → npm install

For more information, visit: https://github.com/your-username/lockfile-guardian
`);
}

function showStatus(): void {
  const cwd = process.cwd();
  const version = getVersion();

  console.log(`🔒 Lockfile Guardian v${version}\n`);

  // Check if we're in a git repository
  if (!isGitRepository(cwd)) {
    console.log("❌ Not a git repository");
    return;
  }

  console.log("✅ Git repository detected");

  // Check for lockfile
  const lockfileInfo = findLockfile(cwd);
  if (!lockfileInfo) {
    console.log("❌ No supported lockfile found");
    console.log(
      `   Supported: ${PACKAGE_MANAGERS.map((pm) => pm.lockFile).join(", ")}`
    );
    return;
  }

  console.log(
    `✅ Lockfile found: ${lockfileInfo.packageManager.lockFile} (${lockfileInfo.packageManager.name})`
  );

  // Check if hooks are installed
  const hooksInstalled = areHooksInstalled(cwd);
  if (hooksInstalled) {
    console.log("✅ Git hooks installed");
  } else {
    console.log("❌ Git hooks not installed");
    console.log('   Run "npx lockfile-guardian install" to set up');
  }

  // Show configuration
  const config = loadConfig(cwd);
  console.log("\nConfiguration:");
  console.log(`  autoInstall: ${config.autoInstall || false}`);
  console.log(`  silent: ${config.silent || false}`);
  console.log(`  checkNodeModules: ${config.checkNodeModules !== false}`);

  if (!hooksInstalled) {
    console.log("\n💡 Quick start: npx lockfile-guardian install");
  }
}

async function handleInstall(): Promise<void> {
  const cwd = process.cwd();

  if (!isGitRepository(cwd)) {
    logError(
      "Error: Not a git repository. Please run this command in a git repository."
    );
    process.exit(1);
  }

  const lockfileInfo = findLockfile(cwd);
  if (!lockfileInfo) {
    logError("Error: No supported lockfile found.");
    logError(
      `Supported lockfiles: ${PACKAGE_MANAGERS.map((pm) => pm.lockFile).join(
        ", "
      )}`
    );
    process.exit(1);
  }

  try {
    installGitHooks(cwd);
    log("🔒 Git hooks installed successfully!");
    log(`🔒 Monitoring: ${lockfileInfo.packageManager.lockFile}`);
    log("🔒 Lockfile Guardian is now active");

    // Initialize with current hash
    await checkLockfile(false, cwd);
  } catch (error) {
    logError(
      `Error installing git hooks: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
}

async function handleUninstall(): Promise<void> {
  const cwd = process.cwd();

  try {
    uninstallGitHooks(cwd);
    clearStoredHash(cwd);
    log("🔒 Lockfile Guardian uninstalled successfully");
    log("🔒 All git hooks and data have been removed");
  } catch (error) {
    logError(
      `Error uninstalling: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
}

async function handleCheck(isHook: boolean = false): Promise<void> {
  const cwd = process.cwd();

  try {
    await checkLockfile(isHook, cwd);
  } catch (error) {
    logError(
      `Error checking lockfile: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  switch (args.command) {
    case "install":
      await handleInstall();
      break;

    case "uninstall":
      await handleUninstall();
      break;

    case "check":
      await handleCheck(args.isHook);
      break;

    case "help":
      showHelp();
      break;

    default:
      showStatus();
      break;
  }
}

// Run the CLI
main().catch((error) => {
  logError(
    `Unexpected error: ${
      error instanceof Error ? error.message : "Unknown error"
    }`
  );
  process.exit(1);
});
