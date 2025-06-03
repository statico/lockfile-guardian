import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("Husky Compatibility Integration Tests", () => {
  test("should work with Husky projects using post-install hooks", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky
      await repo.setupHusky();

      // Install lockfile guardian
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian installed successfully! (Husky compatible)"
      );
      assertContains(
        result.stdout,
        "🐶 Git hooks installed to .husky/ directory"
      );
      assertContains(
        result.stdout,
        "🔒 Post-install hook added to package.json"
      );
      assertContains(result.stdout, "🔒 Monitoring: pnpm-lock.yaml");

      // Should install both git hooks and post-install hooks
    } finally {
      await cleanup(repo);
    }
  });

  test("should show Husky compatibility in status", async () => {
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

  test("should not interfere with existing Husky setup", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Setup Husky with existing hooks
      await repo.setupHusky();

      // Add custom content to a Husky hook
      const existingContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Custom Husky hook"
npm run build`;

      await repo.writeFile(".husky/post-checkout", existingContent);

      // Install lockfile guardian
      await runCli("install", { cwd: repo.path });

      // Check that Husky hooks preserve existing content and add lockfile guardian
      const hookContent = await repo.readFile(".husky/post-checkout");
      assertContains(hookContent, 'echo "Custom Husky hook"');
      assertContains(hookContent, "npm run build");
      assertContains(hookContent, "npx lockfile-guardian check --hook");
    } finally {
      await cleanup(repo);
    }
  });

  test("should work with traditional git hooks when Husky is not setup", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Do not set up Husky
      const result = await runCli("install", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(
        result.stdout,
        "🔒 Lockfile Guardian installed successfully!"
      );
      assertContains(
        result.stdout,
        "🔧 Git hooks installed to .git/hooks/ directory"
      );
      assertContains(result.stdout, "🔒 Monitoring: pnpm-lock.yaml");
    } finally {
      await cleanup(repo);
    }
  });
});
