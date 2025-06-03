import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { updateHashAfterInstall } from "./guardian";
import { loadConfig, log, logError, PACKAGE_MANAGERS } from "./utils";

interface PackageJsonScripts {
  [key: string]: string;
}

interface PackageJson {
  scripts?: PackageJsonScripts;
  [key: string]: any;
}

const POST_INSTALL_SCRIPT_NAME = "postinstall";
const LOCKFILE_GUARDIAN_HOOK = "npx lockfile-guardian post-install";

/**
 * Add post-install script to package.json that will update lockfile hash after installs
 */
export function installPostInstallHook(cwd: string = process.cwd()): void {
  const packageJsonPath = join(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error("package.json not found in current directory");
  }

  let packageJson: PackageJson;
  try {
    const content = readFileSync(packageJsonPath, "utf8");
    packageJson = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to read or parse package.json: ${(error as Error).message}`
    );
  }

  // Initialize scripts object if it doesn't exist
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const currentPostInstall = packageJson.scripts[POST_INSTALL_SCRIPT_NAME];

  // Check if our hook is already present
  if (
    currentPostInstall &&
    currentPostInstall.includes(LOCKFILE_GUARDIAN_HOOK)
  ) {
    log("🔒 Lockfile Guardian post-install hook is already configured");
    return;
  }

  // Add or append our hook to the postinstall script
  if (currentPostInstall) {
    // Append to existing postinstall script
    packageJson.scripts[
      POST_INSTALL_SCRIPT_NAME
    ] = `${currentPostInstall} && ${LOCKFILE_GUARDIAN_HOOK}`;
    log("🔒 Added Lockfile Guardian hook to existing postinstall script");
  } else {
    // Create new postinstall script
    packageJson.scripts[POST_INSTALL_SCRIPT_NAME] = LOCKFILE_GUARDIAN_HOOK;
    log("🔒 Created postinstall script with Lockfile Guardian hook");
  }

  // Write back to package.json with proper formatting
  try {
    const formattedJson = JSON.stringify(packageJson, null, 2) + "\n";
    writeFileSync(packageJsonPath, formattedJson, "utf8");
    log("✅ package.json updated successfully");
  } catch (error) {
    throw new Error(
      `Failed to write package.json: ${(error as Error).message}`
    );
  }
}

/**
 * Remove post-install script hook from package.json
 */
export function uninstallPostInstallHook(cwd: string = process.cwd()): void {
  const packageJsonPath = join(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    log("package.json not found - nothing to uninstall");
    return;
  }

  let packageJson: PackageJson;
  try {
    const content = readFileSync(packageJsonPath, "utf8");
    packageJson = JSON.parse(content);
  } catch (error) {
    logError(
      `Failed to read or parse package.json: ${(error as Error).message}`
    );
    return;
  }

  if (!packageJson.scripts || !packageJson.scripts[POST_INSTALL_SCRIPT_NAME]) {
    log("No postinstall script found - nothing to uninstall");
    return;
  }

  const currentPostInstall = packageJson.scripts[POST_INSTALL_SCRIPT_NAME];

  // Check if our hook is present
  if (!currentPostInstall.includes(LOCKFILE_GUARDIAN_HOOK)) {
    log("Lockfile Guardian hook not found in postinstall script");
    return;
  }

  // Remove our hook from the script
  let newPostInstall = currentPostInstall
    .replace(
      new RegExp(
        `\\s*&&\\s*${LOCKFILE_GUARDIAN_HOOK.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}`
      ),
      ""
    )
    .replace(
      new RegExp(
        `^${LOCKFILE_GUARDIAN_HOOK.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}\\s*&&\\s*`
      ),
      ""
    )
    .replace(
      new RegExp(
        `^${LOCKFILE_GUARDIAN_HOOK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
      ),
      ""
    )
    .trim();

  if (newPostInstall === "") {
    // Remove the entire postinstall script if it's empty
    delete packageJson.scripts[POST_INSTALL_SCRIPT_NAME];
    log(
      "🔒 Removed postinstall script (was only containing Lockfile Guardian hook)"
    );
  } else {
    // Update with the remaining script
    packageJson.scripts[POST_INSTALL_SCRIPT_NAME] = newPostInstall;
    log("🔒 Removed Lockfile Guardian hook from postinstall script");
  }

  // Write back to package.json
  try {
    const formattedJson = JSON.stringify(packageJson, null, 2) + "\n";
    writeFileSync(packageJsonPath, formattedJson, "utf8");
    log("✅ package.json updated successfully");
  } catch (error) {
    logError(`Failed to write package.json: ${(error as Error).message}`);
  }
}

/**
 * Check if post-install hook is installed
 */
export function isPostInstallHookInstalled(
  cwd: string = process.cwd()
): boolean {
  const packageJsonPath = join(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, "utf8");
    const packageJson: PackageJson = JSON.parse(content);

    const postInstallScript = packageJson.scripts?.[POST_INSTALL_SCRIPT_NAME];
    return postInstallScript
      ? postInstallScript.includes(LOCKFILE_GUARDIAN_HOOK)
      : false;
  } catch {
    return false;
  }
}

/**
 * The actual post-install hook that gets called after package installation
 */
export function runPostInstallHook(cwd: string = process.cwd()): void {
  const config = loadConfig(cwd);

  try {
    updateHashAfterInstall(cwd);
  } catch (error) {
    if (!config.silent) {
      logError(
        `Lockfile Guardian post-install hook failed: ${
          (error as Error).message
        }`
      );
    }
  }
}
