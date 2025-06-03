import { strict as assert } from "assert";
import { describe, test } from "node:test";

import {
  assertContains,
  assertStartsWith,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("CLI Commands Integration Tests", () => {
  test("should show help with --help flag", async () => {
    const result = await runCli("--help");

    assertSuccessfulCommand(result);
    assertContains(result.stdout, "🔒 Lockfile Guardian");
    assertContains(result.stdout, "USAGE:");
    assertContains(result.stdout, "COMMANDS:");
    assertContains(result.stdout, "install");
    assertContains(result.stdout, "uninstall");
    assertContains(result.stdout, "check");
    assertContains(result.stdout, "help");
    assertContains(result.stdout, "EXAMPLES:");
    assertContains(result.stdout, "CONFIGURATION:");
    assertContains(result.stdout, "SUPPORTED PACKAGE MANAGERS:");
  });

  test("should show help with help command", async () => {
    const result = await runCli("help");

    assertSuccessfulCommand(result);
    assertContains(result.stdout, "🔒 Lockfile Guardian");
    assertContains(
      result.stdout,
      "Never forget to install dependencies again!"
    );
  });

  test("should show status when no command provided", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      const result = await runCli("", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "🔒 Lockfile Guardian v");
      assertContains(result.stdout, "✅ Git repository detected");
      assertContains(result.stdout, "✅ Lockfile found: pnpm-lock.yaml");
      assertContains(result.stdout, "❌ Git hooks not installed");
      assertContains(result.stdout, "❌ Post-install hook not installed");
      assertContains(
        result.stdout,
        'Run "npx lockfile-guardian install" to set up'
      );
      assertContains(
        result.stdout,
        "💡 Quick start: npx lockfile-guardian install"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should show status with hooks installed", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      await runCli("install", { cwd: repo.path });

      const result = await runCli("", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "✅ Post-install hook installed");
      assert(
        !result.stdout.includes(
          'Run "npx lockfile-guardian install" to set up'
        ),
        "Should not show setup message when already installed"
      );
      assertContains(
        result.stdout,
        "💡 Quick start: npx lockfile-guardian install"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should show status for different package managers", async () => {
    const packageManagers = [
      { name: "pnpm", lockfile: "pnpm-lock.yaml" },
      { name: "yarn", lockfile: "yarn.lock" },
      { name: "npm", lockfile: "package-lock.json" },
    ];

    for (const pm of packageManagers) {
      const repo = await createTestRepo(pm.name);

      try {
        const result = await runCli("", { cwd: repo.path });

        assertSuccessfulCommand(result);
        assertContains(
          result.stdout,
          `✅ Lockfile found: ${pm.lockfile} (${pm.name})`
        );
      } finally {
        await cleanup(repo);
      }
    }
  });

  test("should show error when not in git repository", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      await repo.runCommand("rm", ["-rf", ".git"]);

      const result = await runCli("", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "❌ Not a git repository");
    } finally {
      await cleanup(repo);
    }
  });

  test("should show error when no lockfile found", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      await repo.runCommand("rm", ["pnpm-lock.yaml"]);

      const result = await runCli("", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "❌ No supported lockfile found");
      assertContains(
        result.stdout,
        "pnpm-lock.yaml, yarn.lock, package-lock.json"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should display custom configuration", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      await repo.addConfig({
        autoInstall: true,
        silent: true,
        checkNodeModules: false,
      });

      const result = await runCli("", { cwd: repo.path });

      assertSuccessfulCommand(result);
      assertContains(result.stdout, "autoInstall: true");
      assertContains(result.stdout, "silent: true");
      assertContains(result.stdout, "checkNodeModules: false");
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle unknown commands gracefully", async () => {
    const result = await runCli("unknown-command");

    assertSuccessfulCommand(result);
    assertStartsWith(result.stdout, "🔒 Lockfile Guardian v");
    // Should show status instead of erroring
  });

  test("should show version in help and status", async () => {
    const helpResult = await runCli("help");
    const statusResult = await runCli("");

    assertSuccessfulCommand(helpResult);
    assertSuccessfulCommand(statusResult);

    // Both should contain version information
    assert(
      /🔒 Lockfile Guardian v\d+\.\d+\.\d+/.test(helpResult.stdout),
      "Help should show version"
    );
    assert(
      /🔒 Lockfile Guardian v\d+\.\d+\.\d+/.test(statusResult.stdout),
      "Status should show version"
    );
  });

  test("should handle -h flag for help", async () => {
    const result = await runCli("-h");

    assertSuccessfulCommand(result);
    assertContains(result.stdout, "🔒 Lockfile Guardian");
    assertContains(result.stdout, "USAGE:");
  });
});
