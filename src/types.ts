export interface LockfileGuardianConfig {
  autoInstall?: boolean;
  silent?: boolean;
  checkNodeModules?: boolean;
}

export interface PackageManager {
  name: "npm" | "yarn" | "pnpm";
  lockFile: string;
  installCommand: string;
}

export interface LockfileInfo {
  path: string;
  packageManager: PackageManager;
  hash: string;
}

export interface GitHookType {
  name: string;
  path: string;
}
