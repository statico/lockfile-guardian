import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
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
      // Setup Husky first
      await repo.setupHusky();

      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Git hooks installed successfully! (Husky compatible)"
      );
      assertContains(result.stdout, "🐶 Installed to .husky/ directory");
      assertContains(result.stdout, "🔗 Compatible with lint-staged, prettier");

      // Verify hooks are installed in .husky directory
      assert.ok(await repo.hasHuskyHook("post-checkout"));
      assert.ok(await repo.hasHuskyHook("post-merge"));
      assert.ok(await repo.hasHuskyHook("post-rewrite"));

      // Verify guardian data file is created
      assert.ok(await repo.hasGuardianData());
    } finally {
      await cleanup(repo);
    }
  });

  test("should preserve existing Husky hooks and append lockfile guardian", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky with existing pre-commit hook
      await repo.setupHusky();

      // Add a post-checkout hook with existing content
      const existingHookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running post-checkout script"
npm run build
`;
      await repo.writeFile(".husky/post-checkout", existingHookContent);

      // Install lockfile guardian
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);

      // Check that our hook was added to existing content
      const hookContent = await repo.readHuskyHook("post-checkout");
      assertContains(hookContent, 'echo "Running post-checkout script"');
      assertContains(hookContent, "npm run build");
      assertContains(hookContent, "npx lockfile-guardian check --hook");
      assertContains(hookContent, "# Lockfile Guardian");

      // Verify the original husky shebang is preserved
      assertContains(hookContent, '. "$(dirname -- "$0")/_/husky.sh"');
    } finally {
      await cleanup(repo);
    }
  });

  test("should work with lint-staged configuration", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky with lint-staged
      await repo.setupHusky();

      // Install lockfile guardian
      await runCli("install", { cwd: repo.path });

      // Verify the pre-commit hook contains both lint-staged and lockfile guardian
      const preCommitContent = await repo.readHuskyHook("pre-commit");
      assertContains(preCommitContent, "npx lint-staged");

      // Post-checkout should have lockfile guardian
      const postCheckoutContent = await repo.readHuskyHook("post-checkout");
      assertContains(postCheckoutContent, "npx lockfile-guardian check --hook");

      // Verify package.json has lint-staged config
      const packageJson = JSON.parse(await repo.readFile("package.json"));
      assert.ok(packageJson["lint-staged"]);
      assert.ok(packageJson["lint-staged"]["*.{js,ts,tsx}"]);
      assertContains(
        JSON.stringify(packageJson["lint-staged"]),
        "prettier --write"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should not duplicate hooks on multiple installs in Husky projects", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky
      await repo.setupHusky();

      // Install twice
      await runCli("install", { cwd: repo.path });
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);

      // Check that hook is not duplicated
      const hookContent = await repo.readHuskyHook("post-checkout");
      const matches = (
        hookContent.match(/npx lockfile-guardian check --hook/g) || []
      ).length;
      assert.strictEqual(matches, 1, "Hook command should appear only once");
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
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Git hooks installed successfully!");
      assertContains(result.stdout, "🔧 Installed to .git/hooks/ directory");

      // Should NOT contain Husky-specific messages
      assert.ok(!result.stdout.includes("🐶"));
      assert.ok(!result.stdout.includes("Husky compatible"));

      // Verify hooks are installed in traditional location
      assert.ok(await repo.hasHook("post-checkout"));
      assert.ok(await repo.hasHook("post-merge"));
      assert.ok(await repo.hasHook("post-rewrite"));

      // Should not create hooks in .husky directory
      assert.ok(!(await repo.hasHuskyHook("post-checkout")));
    } finally {
      await cleanup(repo);
    }
  });

  test("should show correct status for Husky vs traditional setup", async () => {
    const repoHusky = await createTestRepo("pnpm");
    const repoTraditional = await createTestRepo("pnpm");

    try {
      // Setup one repo with Husky
      await repoHusky.setupHusky();
      await runCli("install", { cwd: repoHusky.path });

      // Setup another repo with traditional hooks
      await runCli("install", { cwd: repoTraditional.path });

      // Check Husky repo status
      const huskyStatus = await runCli("", { cwd: repoHusky.path });
      assertContains(huskyStatus.stdout, "🐶 Husky detected");
      assertContains(huskyStatus.stdout, ".husky/");
      assertContains(huskyStatus.stdout, "🔗 Husky Compatibility:");

      // Check traditional repo status
      const traditionalStatus = await runCli("", { cwd: repoTraditional.path });
      assertContains(traditionalStatus.stdout, "🔧 Using standard git hooks");
      assertContains(traditionalStatus.stdout, ".git/hooks");
      assert.ok(!traditionalStatus.stdout.includes("🐶"));
      assert.ok(!traditionalStatus.stdout.includes("Husky Compatibility"));
    } finally {
      await cleanup(repoHusky);
      await cleanup(repoTraditional);
    }
  });

  test("should handle edge case where .husky exists but core.hooksPath is not set", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create .husky directory but don't set core.hooksPath
      await repo.runCommand("mkdir", ["-p", ".husky"]);

      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      // Should use traditional hooks since core.hooksPath is not set to .husky
      assertContains(result.stdout, "🔧 Installed to .git/hooks/ directory");
      assert.ok(!result.stdout.includes("🐶"));

      // Verify hooks are in traditional location
      assert.ok(await repo.hasHook("post-checkout"));
      assert.ok(!(await repo.hasHuskyHook("post-checkout")));
    } finally {
      await cleanup(repo);
    }
  });

  test("should run lockfile guardian after other hooks in Husky setup", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky with a post-checkout hook that creates a marker file
      await repo.setupHusky();

      const markerHookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "pre-guardian" > /tmp/hook-execution-order
`;
      await repo.writeFile(".husky/post-checkout", markerHookContent);

      // Install lockfile guardian
      await runCli("install", { cwd: repo.path });

      // Verify our hook was appended (should run after the marker creation)
      const hookContent = await repo.readHuskyHook("post-checkout");
      assertContains(
        hookContent,
        'echo "pre-guardian" > /tmp/hook-execution-order'
      );

      // Lockfile guardian should come after
      const guardianPos = hookContent.indexOf(
        "npx lockfile-guardian check --hook"
      );
      const markerPos = hookContent.indexOf('echo "pre-guardian"');
      assert.ok(
        guardianPos > markerPos,
        "Lockfile Guardian should run after existing hooks"
      );
    } finally {
      await cleanup(repo);
    }
  });
});
