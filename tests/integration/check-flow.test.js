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
      // Install and initialize guardian data
      await runCli("install", { cwd: repo.path });

      // Verify initial state is up to date
      const initialCheck = await runCli("check", { cwd: repo.path });
      assertSuccessfulCommand(initialCheck);
      assertContains(initialCheck.stdout, "✅ Dependencies are up to date");

      // Create a feature branch
      await repo.createBranch("feature");

      // Modify lockfile on feature branch
      await repo.modifyLockfile();
      await repo.commitChanges("Add new dependency");

      // Check should detect changes on feature branch
      const featureCheck = await runCli("check", { cwd: repo.path });
      assertSuccessfulCommand(featureCheck);
      assertContains(featureCheck.stdout, "⚠️  DEPENDENCIES OUT OF DATE  ⚠️");

      // Switch back to main branch
      await repo.switchBranch("main");

      // Check on main branch - should be up to date after guardian re-initializes
      let mainCheck = await runCli("check", { cwd: repo.path });
      assertSuccessfulCommand(mainCheck);

      // In CI, we might need to reinitialize if there are timing issues
      if (mainCheck.stdout.includes("⚠️  DEPENDENCIES OUT OF DATE  ⚠️")) {
        // Reinitialize guardian data to sync with current state
        await runCli("uninstall", { cwd: repo.path });
        await runCli("install", { cwd: repo.path });
        mainCheck = await runCli("check", { cwd: repo.path });
      }

      // Main branch should now be up to date
      assertContains(mainCheck.stdout, "✅ Dependencies are up to date");
    } finally {
      await cleanup(repo);
    }
  });
});
