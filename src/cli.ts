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
  install           Setup lockfile monitoring (one-time setup)
  install-git-hooks Install git hooks to monitor branch changes
  install-post-hooks Install post-install script to track package installs
  uninstall         Remove all hooks and cleanup
  uninstall-git-hooks Remove git hooks only
  uninstall-post-hooks Remove post-install hooks only
  check             Manually check for lock file changes
  post-install      Update hash after package install (called by postinstall script)
  help              Show this help message

EXAMPLES:
  npx lockfile-guardian install            # Setup lockfile monitoring (recommended)
  npx lockfile-guardian install-git-hooks  # Use git hooks specifically
  npx lockfile-guardian check              # Check dependencies manually
  npx lockfile-guardian uninstall          # Remove all hooks

CONFIGURATION:
Add optional configuration to your package.json:

{
  "lockfileGuardian": {
    "autoInstall": true,       // Automatically run install commands
    "silent": false,           // Suppress non-warning output
    "checkNodeModules": true   // Warn if node_modules isn't gitignored
  }
}

HOOK STRATEGIES:
  Default: Post-install hooks (most accurate, recommended)
  Alternative: Git hooks (warns on branch changes)

  The default approach only tracks changes when you actually install packages,
  eliminating false warnings when just switching branches to read code.

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

  if (!gitHooksInstalled && !postInstallHookInstalled) {
    console.log(
      '   Run "npx lockfile-guardian install" to set up (recommended)'
    );
    console.log(
      '   Or "npx lockfile-guardian install-git-hooks" for git-based monitoring'
    );
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
  // Use post-install hooks by default since they're more accurate
  await handleInstallPostHooks();
}

async function handleInstallGitHooks(): Promise<void> {
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
    installGitHooks(cwd);

    if (isHusky) {
      log("🔒 Git hooks installed successfully! (Husky compatible)");
      log("🐶 Installed to .husky/ directory");
      log("🔗 Compatible with lint-staged, prettier, and other Husky tools");
    } else {
      log("🔒 Git hooks installed successfully!");
      log("🔧 Installed to .git/hooks/ directory");
    }

    log(`🔒 Monitoring: ${lockfileInfo.packageManager.lockFile}`);
    log("🔒 Lockfile Guardian git hooks are now active");

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

async function handleInstallPostHooks(): Promise<void> {
  const cwd = process.cwd();

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
    installPostInstallHook(cwd);

    log(`🔒 Monitoring: ${lockfileInfo.packageManager.lockFile}`);
    log("🔒 Post-install hook is now active");
    log("🔒 Hash will be updated only when you run package install commands");

    // Initialize with current hash
    await checkLockfile(false, cwd);
  } catch (error) {
    logError(
      `Error installing post-install hook: ${
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

async function handleUninstallGitHooks(): Promise<void> {
  const cwd = process.cwd();

  try {
    uninstallGitHooks(cwd);
    log("🔒 Git hooks uninstalled successfully");
  } catch (error) {
    logError(
      `Error uninstalling git hooks: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
}

async function handleUninstallPostHooks(): Promise<void> {
  const cwd = process.cwd();

  try {
    uninstallPostInstallHook(cwd);
    log("🔒 Post-install hook uninstalled successfully");
  } catch (error) {
    logError(
      `Error uninstalling post-install hook: ${
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

    case "install-git-hooks":
      await handleInstallGitHooks();
      break;

    case "install-post-hooks":
      await handleInstallPostHooks();
      break;

    case "uninstall":
      await handleUninstall();
      break;

    case "uninstall-git-hooks":
      await handleUninstallGitHooks();
      break;

    case "uninstall-post-hooks":
      await handleUninstallPostHooks();
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
