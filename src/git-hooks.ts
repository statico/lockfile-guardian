import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  chmodSync,
} from "fs";
import { join } from "path";
import { GitHookType } from "./types";
import { getGitHooksDir, isGitRepository } from "./utils";

const HOOK_SHEBANG = "#!/bin/sh";
const HOOK_COMMAND = "npx lockfile-guardian check --hook";

const GIT_HOOKS: GitHookType[] = [
  { name: "post-checkout", path: "post-checkout" },
  { name: "post-merge", path: "post-merge" },
  { name: "post-rewrite", path: "post-rewrite" },
];

function createHookContent(existingContent?: string): string {
  const hookLine = HOOK_COMMAND;

  // If there's existing content, preserve it and add our hook
  if (existingContent && existingContent.trim()) {
    const lines = existingContent.split("\n");

    // Check if our hook is already present
    if (lines.some((line) => line.includes(HOOK_COMMAND))) {
      return existingContent;
    }

    // Add our hook after the shebang
    const shebangIndex = lines.findIndex((line) => line.startsWith("#!"));
    if (shebangIndex >= 0) {
      lines.splice(shebangIndex + 1, 0, "", `# Lockfile Guardian`, hookLine);
    } else {
      lines.unshift(HOOK_SHEBANG, "", "# Lockfile Guardian", hookLine);
    }

    return lines.join("\n");
  }

  // Create new hook content
  return [HOOK_SHEBANG, "", "# Lockfile Guardian", hookLine, ""].join("\n");
}

function removeHookContent(content: string): string | null {
  const lines = content.split("\n");
  const filteredLines = lines.filter(
    (line) =>
      !line.includes(HOOK_COMMAND) && !line.includes("# Lockfile Guardian")
  );

  // If only shebang remains, remove the file entirely
  const remainingContent = filteredLines.join("\n").trim();
  if (remainingContent === HOOK_SHEBANG || remainingContent === "") {
    return null;
  }

  return filteredLines.join("\n");
}

export function installGitHooks(cwd: string = process.cwd()): void {
  if (!isGitRepository(cwd)) {
    throw new Error(
      "Not a git repository. Please run this command in a git repository."
    );
  }

  const hooksDir = getGitHooksDir(cwd);

  for (const hook of GIT_HOOKS) {
    const hookPath = join(hooksDir, hook.path);

    let existingContent = "";
    if (existsSync(hookPath)) {
      existingContent = readFileSync(hookPath, "utf8");
    }

    const newContent = createHookContent(existingContent);
    writeFileSync(hookPath, newContent, "utf8");
    chmodSync(hookPath, 0o755); // Make executable
  }
}

export function uninstallGitHooks(cwd: string = process.cwd()): void {
  if (!isGitRepository(cwd)) {
    return; // Silently skip if not a git repository
  }

  const hooksDir = getGitHooksDir(cwd);

  for (const hook of GIT_HOOKS) {
    const hookPath = join(hooksDir, hook.path);

    if (existsSync(hookPath)) {
      const content = readFileSync(hookPath, "utf8");
      const newContent = removeHookContent(content);

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

  const hooksDir = getGitHooksDir(cwd);

  return GIT_HOOKS.every((hook) => {
    const hookPath = join(hooksDir, hook.path);
    if (!existsSync(hookPath)) {
      return false;
    }

    const content = readFileSync(hookPath, "utf8");
    return content.includes(HOOK_COMMAND);
  });
}
