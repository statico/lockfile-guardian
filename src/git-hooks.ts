import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { GitHookType } from "./types";
import { getActiveHooksDir, isGitRepository, isHuskyProject } from "./utils";

const HOOK_SHEBANG = "#!/bin/sh";
const HOOK_COMMAND = "npx lockfile-guardian check --hook";

const GIT_HOOKS: GitHookType[] = [
  { name: "post-checkout", path: "post-checkout" },
  { name: "post-merge", path: "post-merge" },
  { name: "post-rewrite", path: "post-rewrite" },
];

function createHookContent(
  existingContent?: string,
  isHusky: boolean = false
): string {
  const hookLine = HOOK_COMMAND;

  // If there's existing content, preserve it and add our hook
  if (existingContent && existingContent.trim()) {
    const lines = existingContent.split("\n");

    // Check if our hook is already present
    if (lines.some((line) => line.includes(HOOK_COMMAND))) {
      return existingContent;
    }

    // For Husky hooks, we want to add our command at the end to run after other hooks
    // For traditional hooks, we add after the shebang
    if (isHusky) {
      // Husky hooks don't need shebang handling, just append
      return existingContent + "\n\n# Lockfile Guardian\n" + hookLine;
    } else {
      // Traditional git hooks - add after shebang
      const shebangIndex = lines.findIndex((line) => line.startsWith("#!"));
      if (shebangIndex >= 0) {
        lines.splice(shebangIndex + 1, 0, "", `# Lockfile Guardian`, hookLine);
      } else {
        lines.unshift(HOOK_SHEBANG, "", "# Lockfile Guardian", hookLine);
      }
      return lines.join("\n");
    }
  }

  // Create new hook content
  if (isHusky) {
    // Husky hooks are simpler - just the command with a comment
    return ["# Lockfile Guardian", hookLine, ""].join("\n");
  } else {
    // Traditional hooks need shebang
    return [HOOK_SHEBANG, "", "# Lockfile Guardian", hookLine, ""].join("\n");
  }
}

function removeHookContent(
  content: string,
  isHusky: boolean = false
): string | null {
  const lines = content.split("\n");
  const filteredLines = lines.filter(
    (line) =>
      !line.includes(HOOK_COMMAND) && !line.includes("# Lockfile Guardian")
  );

  const remainingContent = filteredLines.join("\n").trim();

  if (isHusky) {
    // For Husky hooks, if no content remains, remove the file
    if (remainingContent === "") {
      return null;
    }
    return filteredLines.join("\n");
  } else {
    // For traditional hooks, if only shebang remains, remove the file entirely
    if (remainingContent === HOOK_SHEBANG || remainingContent === "") {
      return null;
    }
    return filteredLines.join("\n");
  }
}

export function installGitHooks(cwd: string = process.cwd()): void {
  if (!isGitRepository(cwd)) {
    throw new Error(
      "Not a git repository. Please run this command in a git repository."
    );
  }

  const isHusky = isHuskyProject(cwd);
  const hooksDir = getActiveHooksDir(cwd);

  // Create hooks directory if it doesn't exist
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  for (const hook of GIT_HOOKS) {
    const hookPath = join(hooksDir, hook.path);

    let existingContent = "";
    if (existsSync(hookPath)) {
      existingContent = readFileSync(hookPath, "utf8");
    }

    const newContent = createHookContent(existingContent, isHusky);
    writeFileSync(hookPath, newContent, "utf8");

    // Make executable (important for both traditional and Husky hooks)
    chmodSync(hookPath, 0o755);
  }
}

export function uninstallGitHooks(cwd: string = process.cwd()): void {
  if (!isGitRepository(cwd)) {
    return; // Silently skip if not a git repository
  }

  const isHusky = isHuskyProject(cwd);
  const hooksDir = getActiveHooksDir(cwd);

  for (const hook of GIT_HOOKS) {
    const hookPath = join(hooksDir, hook.path);

    if (existsSync(hookPath)) {
      const content = readFileSync(hookPath, "utf8");
      const newContent = removeHookContent(content, isHusky);

      if (newContent === null) {
        unlinkSync(hookPath);
      } else {
        writeFileSync(hookPath, newContent, "utf8");
      }
    }
  }
}

export function areHooksInstalled(cwd: string = process.cwd()): boolean {
  if (!isGitRepository(cwd)) {
    return false;
  }

  const hooksDir = getActiveHooksDir(cwd);

  return GIT_HOOKS.every((hook) => {
    const hookPath = join(hooksDir, hook.path);
    if (!existsSync(hookPath)) {
      return false;
    }

    const content = readFileSync(hookPath, "utf8");
    return content.includes(HOOK_COMMAND);
  });
}
