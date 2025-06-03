// Main exports for programmatic usage
export {
  installGitHooks,
  uninstallGitHooks,
  areHooksInstalled,
} from "./git-hooks";
export {
  checkLockfile,
  storeCurrentHash,
  getStoredHash,
  clearStoredHash,
} from "./guardian";
export {
  findLockfile,
  isGitRepository,
  loadConfig,
  isNodeModulesIgnored,
  PACKAGE_MANAGERS,
} from "./utils";
export * from "./types";
