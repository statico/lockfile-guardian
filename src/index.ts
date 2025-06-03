// Main exports for programmatic usage
export {
  areHooksInstalled,
  installGitHooks,
  uninstallGitHooks,
} from "./git-hooks";
export {
  checkLockfile,
  clearStoredHash,
  getStoredHash,
  storeCurrentHash,
  updateHashAfterInstall,
} from "./guardian";
export {
  installPostInstallHook,
  uninstallPostInstallHook,
  isPostInstallHookInstalled,
  runPostInstallHook,
} from "./post-install";
export * from "./types";
export {
  findLockfile,
  isGitRepository,
  isNodeModulesIgnored,
  loadConfig,
  PACKAGE_MANAGERS,
} from "./utils";
