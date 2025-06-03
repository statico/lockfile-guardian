import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
  assertFailedCommand,
  assertGuardianDataExists,
  assertHookInstalled,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("Install Flow Integration Tests", () => {
  test("should install lockfile monitoring successfully", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Post-install hook is now active");
      assertContains(result.stdout, "🔒 Monitoring: pnpm-lock.yaml");
      assertContains(
        result.stdout,
        "🔒 Hash will be updated only when you run package install commands"
      );

      // Verify guardian data file is created
      await assertGuardianDataExists(repo);
    } finally {
      await cleanup(repo);
    }
  });

  test("should install hooks for yarn projects", async () => {
    const repo = await createTestRepo("yarn");

    try {
      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Git hooks installed successfully!");
      assertContains(result.stdout, "🔒 Monitoring: yarn.lock");

      // Verify hooks are installed
      await assertHookInstalled(repo, "post-checkout");
      await assertHookInstalled(repo, "post-merge");
      await assertHookInstalled(repo, "post-rewrite");

      // Verify guardian data file is created
      await assertGuardianDataExists(repo);
    } finally {
      await cleanup(repo);
    }
  });

  test("should install hooks for npm projects", async () => {
    const repo = await createTestRepo("npm");

    try {
      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Git hooks installed successfully!");
      assertContains(result.stdout, "🔒 Monitoring: package-lock.json");

      // Verify hooks are installed
      await assertHookInstalled(repo, "post-checkout");
      await assertHookInstalled(repo, "post-merge");
      await assertHookInstalled(repo, "post-rewrite");

      // Verify guardian data file is created
      await assertGuardianDataExists(repo);
    } finally {
      await cleanup(repo);
    }
  });

  test("should fail when not in git repository", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Remove .git directory
      await repo.runCommand("rm", ["-rf", ".git"]);

      const result = await runCli("install", { cwd: repo.path });

      assertFailedCommand(result);
      assertContains(result.stderr, "Error installing post-install hook");
    } finally {
      await cleanup(repo);
    }
  });

  test("should fail when no lockfile found", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Remove lockfile
      await repo.runCommand("rm", ["pnpm-lock.yaml"]);

      const result = await runCli("install", { cwd: repo.path });

      assertFailedCommand(result);
      assertContains(result.stderr, "No supported lockfile found");
      assertContains(
        result.stderr,
        "pnpm-lock.yaml, yarn.lock, package-lock.json"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should preserve existing git hooks", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create an existing hook
      const existingHookContent = `#!/bin/sh
echo "Existing hook"
exit 0`;

      await repo.writeFile(".git/hooks/post-checkout", existingHookContent);
      await repo.runCommand("chmod", ["+x", ".git/hooks/post-checkout"]);

      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);

      // Check that existing hook content is preserved
      const hookContent = await repo.readFile(".git/hooks/post-checkout");
      assertContains(hookContent, 'echo "Existing hook"');
      assertContains(hookContent, "npx lockfile-guardian check --hook");
    } finally {
      await cleanup(repo);
    }
  });

  test("should not duplicate hooks on multiple installs", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Install twice
      await runCli("install-git-hooks", { cwd: repo.path });
      const result = await runCli("install-git-hooks", { cwd: repo.path });

      assertSuccessfulCommand(result);

      // Check that hook is not duplicated
      const hookContent = await repo.readFile(".git/hooks/post-checkout");
      const matches = hookContent.match(/npx lockfile-guardian check --hook/g);
      assert.strictEqual(
        matches?.length,
        1,
        "Hook command should appear only once"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should initialize guardian data on first install", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Lockfile Guardian initialized");

      // Check that guardian data contains current lockfile hash
      const guardianData = await repo.getGuardianData();
      assert.ok(guardianData, "Guardian data should exist");
      assert.strictEqual(guardianData.length, 64, "Should contain SHA256 hash");
      assert.match(guardianData, /^[a-f0-9]+$/, "Should be hexadecimal hash");
    } finally {
      await cleanup(repo);
    }
  });
});
