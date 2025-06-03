import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
  assertGuardianDataNotExists,
  assertHookNotInstalled,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("Uninstall Flow Integration Tests", () => {
  test("should uninstall git hooks successfully", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // First install
      await runCli("install", { cwd: repo.path });

      // Then uninstall
      const result = await runCli("uninstall", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian uninstalled successfully"
      );
      assertContains(
        result.stdout,
        "🔒 All git hooks, post-install hooks, and data have been removed"
      );

      // Verify hooks are removed
      await assertHookNotInstalled(repo, "post-checkout");
      await assertHookNotInstalled(repo, "post-merge");
      await assertHookNotInstalled(repo, "post-rewrite");

      // Verify guardian data is removed
      await assertGuardianDataNotExists(repo);
    } finally {
      await cleanup(repo);
    }
  });

  test("should preserve existing hook content when uninstalling", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create an existing hook
      const existingHookContent = `#!/bin/sh
echo "Existing hook"
custom_command
exit 0`;

      await repo.writeFile(".git/hooks/post-checkout", existingHookContent);
      await repo.runCommand("chmod", ["+x", ".git/hooks/post-checkout"]);

      // Install lockfile guardian
      await runCli("install", { cwd: repo.path });

      // Uninstall
      await runCli("uninstall", { cwd: repo.path });

      // Check that existing hook content is preserved
      const hookContent = await repo.readFile(".git/hooks/post-checkout");
      assertContains(hookContent, 'echo "Existing hook"');
      assertContains(hookContent, "custom_command");

      // But lockfile guardian content should be removed
      assert(
        !hookContent.includes("npx lockfile-guardian check --hook"),
        "Guardian command should be removed"
      );
      assert(
        !hookContent.includes("# Lockfile Guardian"),
        "Guardian comment should be removed"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should remove hook files completely if only guardian content", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Install guardian
      await runCli("install", { cwd: repo.path });

      // Uninstall
      await runCli("uninstall", { cwd: repo.path });

      // Hook files should be completely removed since they only contained guardian content
      assert(
        !(await repo.fileExists(".git/hooks/post-checkout")),
        "Hook file should be completely removed"
      );
      assert(
        !(await repo.fileExists(".git/hooks/post-merge")),
        "Hook file should be completely removed"
      );
      assert(
        !(await repo.fileExists(".git/hooks/post-rewrite")),
        "Hook file should be completely removed"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should work gracefully when not in git repository", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Remove .git directory
      await repo.runCommand("rm", ["-rf", ".git"]);

      const result = await runCli("uninstall", { cwd: repo.path });

      // Should succeed silently
      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian uninstalled successfully"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should work when hooks are not installed", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Don't install first, just uninstall
      const result = await runCli("uninstall", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian uninstalled successfully"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should work when guardian data file is missing", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Install first
      await runCli("install", { cwd: repo.path });

      // Manually remove guardian data file
      await repo.runCommand("rm", ["-f", ".git/lockfile-guardian"]);

      // Uninstall should still work
      const result = await runCli("uninstall", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian uninstalled successfully"
      );

      // Hooks should still be removed
      await assertHookNotInstalled(repo, "post-checkout");
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle partial hook installations", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Install
      await runCli("install", { cwd: repo.path });

      // Manually remove one hook file
      await repo.runCommand("rm", ["-f", ".git/hooks/post-merge"]);

      // Uninstall should still work for remaining hooks
      const result = await runCli("uninstall", { cwd: repo.path });

      assertSuccessfulCommand(result);

      // All hooks should be cleaned up
      await assertHookNotInstalled(repo, "post-checkout");
      await assertHookNotInstalled(repo, "post-merge");
      await assertHookNotInstalled(repo, "post-rewrite");
    } finally {
      await cleanup(repo);
    }
  });
});
