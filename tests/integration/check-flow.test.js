import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
  assertNotContains,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("Check Flow Integration Tests", () => {
  test("should report up to date dependencies when no changes", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Install and initialize
      await runCli("install", { cwd: repo.path });

      // Check status
      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "✅ Dependencies are up to date");
    } finally {
      await cleanup(repo);
    }
  });

  test("should detect lockfile changes and show warning", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Install and initialize
      await runCli("install", { cwd: repo.path });

      // Modify lockfile
      await repo.modifyLockfile();

      // Check status
      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "⚠️  DEPENDENCIES OUT OF DATE  ⚠️");
      assertContains(result.stdout, "Lock file pnpm-lock.yaml has changed!");
      assertContains(result.stdout, "pnpm install");
      assertContains(result.stdout, "=====================================");
    } finally {
      await cleanup(repo);
    }
  });

  test("should show appropriate commands for different package managers", async () => {
    const packageManagers = ["pnpm", "yarn", "npm"];
    const expectedCommands = ["pnpm install", "yarn install", "npm install"];

    for (let i = 0; i < packageManagers.length; i++) {
      const repo = await createTestRepo(packageManagers[i]);

      try {
        await runCli("install", { cwd: repo.path });
        await repo.modifyLockfile();

        const result = await runCli("check", { cwd: repo.path });

        assertSuccessfulCommand(result);
        assertContains(result.stdout, expectedCommands[i]);
      } finally {
        await cleanup(repo);
      }
    }
  });

  test("should initialize guardian data on first check without install", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Lockfile Guardian initialized");

      // Should have guardian data now
      const guardianData = await repo.getGuardianData();
      assert.ok(guardianData, "Guardian data should be created");
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle missing lockfile gracefully", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Remove lockfile
      await repo.runCommand("rm", ["pnpm-lock.yaml"]);

      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stderr, "No lockfile found");
      assertContains(
        result.stderr,
        "pnpm-lock.yaml, yarn.lock, package-lock.json"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should warn about node_modules not in gitignore", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Remove node_modules from .gitignore
      await repo.writeFile(".gitignore", "*.log\n");

      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "⚠️  Warning: node_modules is not in .gitignore"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should not warn about node_modules when properly gitignored", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertNotContains(result.stdout, "node_modules is not in .gitignore");
    } finally {
      await cleanup(repo);
    }
  });

  test("should respect silent mode configuration", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Add silent configuration
      await repo.addConfig({ silent: true });

      await runCli("install", { cwd: repo.path });

      const result = await runCli("check", { cwd: repo.path });

      assertSuccessfulCommand(result);
      // Should not have any informational output in silent mode
      assert.strictEqual(
        result.stdout.trim(),
        "",
        "Should have no output in silent mode"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle hook mode (--hook flag)", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      await runCli("install", { cwd: repo.path });

      // Test hook mode with no changes
      const result1 = await runCli("check --hook", { cwd: repo.path });
      assertSuccessfulCommand(result1);
      assert.strictEqual(
        result1.stdout.trim(),
        "",
        "Hook mode should be silent when no changes"
      );

      // Test hook mode with changes
      await repo.modifyLockfile();
      const result2 = await runCli("check --hook", { cwd: repo.path });
      assertSuccessfulCommand(result2);
      assertContains(result2.stdout, "⚠️  DEPENDENCIES OUT OF DATE  ⚠️");
    } finally {
      await cleanup(repo);
    }
  });

  test("should detect changes after git operations", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      await runCli("install", { cwd: repo.path });

      // Create a new branch with modified lockfile
      await repo.createBranch("feature");
      await repo.modifyLockfile();
      await repo.commitChanges("Add new dependency");

      // Switch back to main
      await repo.switchBranch("main");

      // Verify we're back to original state
      const result1 = await runCli("check", { cwd: repo.path });
      assertContains(result1.stdout, "✅ Dependencies are up to date");

      // Switch to feature branch
      await repo.switchBranch("feature");

      // Now should detect changes
      const result2 = await runCli("check", { cwd: repo.path });
      assertContains(result2.stdout, "⚠️  DEPENDENCIES OUT OF DATE  ⚠️");
    } finally {
      await cleanup(repo);
    }
  });
});
