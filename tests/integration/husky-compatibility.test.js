import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
  assertGuardianDataExists,
  assertHookInstalled,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("Husky Compatibility Integration Tests", () => {
  test("should detect Husky project correctly", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky
      await repo.setupHusky();

      // Test status command shows Husky detection
      const result = await runCli("", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🐶 Husky detected");
      assertContains(result.stdout, ".husky/");
      assertContains(result.stdout, "🔗 Husky Compatibility:");
      assertContains(result.stdout, "Compatible with lint-staged, prettier");
    } finally {
      await cleanup(repo);
    }
  });

  test("should install hooks in .husky directory for Husky projects", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Set up Husky
      await repo.runCommand("mkdir", [".husky"]);
      await repo.runCommand("git", ["config", "core.hooksPath", ".husky"]);

      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Git hooks installed successfully! (Husky compatible)"
      );
      assertContains(result.stdout, "🐶 Installed to .husky/ directory");
      assertContains(
        result.stdout,
        "🔗 Compatible with lint-staged, prettier, and other Husky tools"
      );

      // Verify hooks are in .husky directory
      assert(
        await repo.hasHuskyHook("post-checkout"),
        "post-checkout hook should be installed in .husky"
      );
      assert(
        await repo.hasHuskyHook("post-merge"),
        "post-merge hook should be installed in .husky"
      );
      assert(
        await repo.hasHuskyHook("post-rewrite"),
        "post-rewrite hook should be installed in .husky"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should preserve existing Husky hooks and append lockfile guardian", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Set up Husky
      await repo.runCommand("mkdir", [".husky"]);
      await repo.runCommand("git", ["config", "core.hooksPath", ".husky"]);

      // Create existing hook
      const existingHookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running post-checkout script"
npm run build`;

      await repo.writeFile(".husky/post-checkout", existingHookContent);
      await repo.runCommand("chmod", ["+x", ".husky/post-checkout"]);

      // Install lockfile guardian
      await runCli("install-git-hooks", { cwd: repo.path });

      // Check that existing content is preserved and lockfile guardian is appended
      const hookContent = await repo.readFile(".husky/post-checkout");
      assertContains(hookContent, 'echo "Running post-checkout script"');
      assertContains(hookContent, "npm run build");
      assertContains(hookContent, "npx lockfile-guardian check --hook");

      // Lockfile Guardian should come after existing content
      const lines = hookContent.split("\n");
      const existingLineIndex = lines.findIndex((line) =>
        line.includes("npm run build")
      );
      const guardianLineIndex = lines.findIndex((line) =>
        line.includes("npx lockfile-guardian check --hook")
      );

      assert(
        existingLineIndex < guardianLineIndex,
        "Existing hook should come before lockfile guardian"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should work with lint-staged configuration", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Set up Husky and lint-staged
      await repo.runCommand("mkdir", [".husky"]);
      await repo.runCommand("git", ["config", "core.hooksPath", ".husky"]);

      // Create pre-commit hook with lint-staged
      const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged`;

      await repo.writeFile(".husky/pre-commit", preCommitContent);
      await repo.runCommand("chmod", ["+x", ".husky/pre-commit"]);

      // Install lockfile guardian
      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Git hooks installed successfully! (Husky compatible)"
      );

      // Pre-commit should remain unchanged
      const preCommitAfter = await repo.readFile(".husky/pre-commit");
      assertContains(preCommitAfter, "npx lint-staged");
      assert(
        !preCommitAfter.includes("npx lockfile-guardian"),
        "Pre-commit should not contain lockfile guardian"
      );

      // Post-checkout should be created with lockfile guardian
      const postCheckoutContent = await repo.readFile(".husky/post-checkout");
      assertContains(postCheckoutContent, "npx lockfile-guardian check --hook");
    } finally {
      await cleanup(repo);
    }
  });

  test("should not duplicate hooks on multiple installs in Husky projects", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Set up Husky
      await repo.runCommand("mkdir", [".husky"]);
      await repo.runCommand("git", ["config", "core.hooksPath", ".husky"]);

      // Install twice
      await runCli("install-git-hooks", { cwd: repo.path });
      await runCli("install-git-hooks", { cwd: repo.path });

      const hookContent = await repo.readFile(".husky/post-checkout");
      const matches = hookContent.match(/npx lockfile-guardian check --hook/g);

      assert.strictEqual(
        matches?.length,
        1,
        "Should only have one lockfile guardian hook"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should uninstall cleanly from Husky projects", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky with existing hooks
      await repo.setupHusky();

      // Add some existing content to post-merge hook
      const existingContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "After merge operations"
`;
      await repo.writeFile(".husky/post-merge", existingContent);

      // Install and then uninstall
      await runCli("install", { cwd: repo.path });
      const result = await runCli("uninstall", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian uninstalled successfully"
      );

      // Check that our content is removed but existing content is preserved
      const hookContent = await repo.readHuskyHook("post-merge");
      assert.ok(!hookContent.includes("npx lockfile-guardian check --hook"));
      assert.ok(!hookContent.includes("# Lockfile Guardian"));
      assertContains(hookContent, 'echo "After merge operations"');

      // Guardian data should be removed
      assert.ok(!(await repo.hasGuardianData()));
    } finally {
      await cleanup(repo);
    }
  });

  test("should work with traditional git hooks when Husky is not setup", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Do not set up Husky (no .husky directory, no core.hooksPath)
      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Git hooks installed successfully!");
      assertContains(result.stdout, "🔧 Installed to .git/hooks/ directory");

      // Verify hooks are in .git/hooks directory
      assert(
        await repo.hasHook("post-checkout"),
        "post-checkout hook should be installed"
      );
      assert(
        await repo.hasHook("post-merge"),
        "post-merge hook should be installed"
      );
      assert(
        await repo.hasHook("post-rewrite"),
        "post-rewrite hook should be installed"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should show correct status for Husky vs traditional setup", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Test traditional setup first
      await runCli("install-git-hooks", { cwd: repo.path });
      let result = await runCli("", { cwd: repo.path });
      assertContains(result.stdout, "🔧 Using standard git hooks");

      // Clean up
      await runCli("uninstall", { cwd: repo.path });

      // Set up Husky
      await repo.runCommand("mkdir", [".husky"]);
      await repo.runCommand("git", ["config", "core.hooksPath", ".husky"]);

      await runCli("install-git-hooks", { cwd: repo.path });
      result = await runCli("", { cwd: repo.path });
      assertContains(
        result.stdout,
        "🐶 Husky detected - using .husky/ directory"
      );
      assertContains(result.stdout, "🔗 Husky Compatibility:");
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle edge case where .husky exists but core.hooksPath is not set", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create .husky directory but don't set core.hooksPath
      await repo.runCommand("mkdir", [".husky"]);

      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Git hooks installed successfully!");
      assertContains(result.stdout, "🔧 Installed to .git/hooks/ directory");

      // Should install to traditional hooks since core.hooksPath is not set
      assert(
        await repo.hasHook("post-checkout"),
        "post-checkout hook should be installed"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should run lockfile guardian after other hooks in Husky setup", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Set up Husky
      await repo.runCommand("mkdir", [".husky"]);
      await repo.runCommand("git", ["config", "core.hooksPath", ".husky"]);

      // Create existing hook with content
      const existingContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "existing hook"
npm run lint`;

      await repo.writeFile(".husky/post-checkout", existingContent);

      // Install guardian
      await runCli("install-git-hooks", { cwd: repo.path });

      const hookContent = await repo.readFile(".husky/post-checkout");
      const lines = hookContent.split("\n");

      const existingHookIndex = lines.findIndex((line) =>
        line.includes("npm run lint")
      );
      const guardianIndex = lines.findIndex((line) =>
        line.includes("npx lockfile-guardian check --hook")
      );

      assert(existingHookIndex >= 0, "Existing hook should be present");
      assert(guardianIndex >= 0, "Guardian hook should be present");
      assert(
        existingHookIndex < guardianIndex,
        "Lockfile Guardian should run after existing hooks"
      );
    } finally {
      await cleanup(repo);
    }
  });
});
