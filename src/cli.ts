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
  installPostInstallHook,
  uninstallPostInstallHook,
  isPostInstallHookInstalled,
  runPostInstallHook,
} from "./post-install";
import {
  findLockfile,
  loadConfig,
  isGitRepository,
  log,
  logError,
  PACKAGE_MANAGERS,
  isHuskyProject,
  getActiveHooksDir,
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
  install       Setup lockfile monitoring (one-time setup)
  uninstall     Remove all hooks and cleanup
  check         Manually check for lock file changes
  help          Show this help message

EXAMPLES:
  npx lockfile-guardian install      # Setup lockfile monitoring
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

  // Check Husky compatibility
  const isHusky = isHuskyProject(cwd);
  const hooksDir = getActiveHooksDir(cwd);

  if (isHusky) {
    console.log("🐶 Husky detected - using .husky/ directory");
    console.log(`   Hooks directory: ${hooksDir}`);
  } else {
    console.log("🔧 Using standard git hooks");
    console.log(`   Hooks directory: ${hooksDir}`);
  }

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
  const gitHooksInstalled = areHooksInstalled(cwd);
  const postInstallHookInstalled = isPostInstallHookInstalled(cwd);

  if (gitHooksInstalled) {
    console.log("✅ Git hooks installed");
  } else {
    console.log("❌ Git hooks not installed");
  }

  if (postInstallHookInstalled) {
    console.log("✅ Post-install hook installed");
  } else {
    console.log("❌ Post-install hook not installed");
  }

  if (!gitHooksInstalled || !postInstallHookInstalled) {
    console.log('   Run "npx lockfile-guardian install" to set up');
  }

  // Show configuration
  const config = loadConfig(cwd);
  console.log("\nConfiguration:");
  console.log(`  autoInstall: ${config.autoInstall || false}`);
  console.log(`  silent: ${config.silent || false}`);
  console.log(`  checkNodeModules: ${config.checkNodeModules !== false}`);

  if (isHusky) {
    console.log("\n🔗 Husky Compatibility:");
    console.log("  ✅ Compatible with lint-staged, prettier, and other tools");
    console.log("  ✅ Lockfile Guardian runs after other hooks");
    console.log("  ✅ Preserves existing hook configurations");
  }

  console.log("\n💡 Quick start: npx lockfile-guardian install");
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

  const isHusky = isHuskyProject(cwd);

  try {
    // Install both git hooks and post-install hooks for optimal experience
    installGitHooks(cwd);
    installPostInstallHook(cwd);

    if (isHusky) {
      log("🔒 Lockfile Guardian installed successfully! (Husky compatible)");
      log("🐶 Git hooks installed to .husky/ directory");
      log("🔗 Compatible with lint-staged, prettier, and other Husky tools");
    } else {
      log("🔒 Lockfile Guardian installed successfully!");
      log("🔧 Git hooks installed to .git/hooks/ directory");
    }

    log("🔒 Post-install hook added to package.json");
    log(`🔒 Monitoring: ${lockfileInfo.packageManager.lockFile}`);
    log(
      "🔒 Git hooks will warn about lockfile changes when switching branches"
    );
    log("🔒 Post-install hook will update hash when you install packages");

    // Initialize with current hash
    await checkLockfile(false, cwd);
  } catch (error) {
    logError(
      `Error installing lockfile guardian: ${
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
    uninstallPostInstallHook(cwd);
    clearStoredHash(cwd);
    log("🔒 Lockfile Guardian uninstalled successfully");
    log("🔒 All git hooks, post-install hooks, and data have been removed");
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

async function handlePostInstall(): Promise<void> {
  const cwd = process.cwd();

  try {
    runPostInstallHook(cwd);
  } catch (error) {
    logError(
      `Error running post-install hook: ${
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

    case "post-install":
      await handlePostInstall();
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
