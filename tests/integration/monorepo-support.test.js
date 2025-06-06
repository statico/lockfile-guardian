import { strict as assert } from "assert";
import { describe, test } from "node:test";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import {
  assertContains,
  assertSuccessfulCommand,
} from "../helpers/assertions.js";
import { cleanup, createTestRepo, runCli } from "../helpers/test-repo.js";

describe("Monorepo Support Integration Tests", () => {
  test("should work when Node.js project is in subdirectory of git repo", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create a subdirectory structure like packages/foo
      const packagesDir = join(repo.path, "packages");
      const projectDir = join(packagesDir, "foo");

      await mkdir(packagesDir, { recursive: true });
      await mkdir(projectDir, { recursive: true });

      // Create package.json in subdirectory
      const packageJson = {
        name: "foo",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
      };
      await writeFile(
        join(projectDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Create lockfile in subdirectory
      const lockfileContent = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:
  .:
    dependencies:
      lodash:
        specifier: ^4.17.21
        version: 4.17.21

packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==}

snapshots:
  lodash@4.17.21: {}
`;
      await writeFile(join(projectDir, "pnpm-lock.yaml"), lockfileContent);

      // Create .gitignore in subdirectory
      await writeFile(join(projectDir, ".gitignore"), "node_modules/\n");

      // Commit the changes to git (from root)
      await repo.runCommand("git", ["add", "."]);
      await repo.runCommand("git", ["commit", "-m", "Add monorepo structure"]);

      // Install from the subdirectory (this should work)
      const installResult = await runCli("install", { cwd: projectDir });
      assertSuccessfulCommand(installResult);
      assertContains(installResult.stdout, "Git hooks installed");
      assertContains(installResult.stdout, "Post-install hook");

      // Check that hooks are actually in the git root, not the subdirectory
      const hasHookInRoot = await repo.hasHook("post-checkout");
      assert.ok(hasHookInRoot, "Hook should be installed in git root");

      // Check status from subdirectory
      const checkResult = await runCli("check", { cwd: projectDir });
      assertSuccessfulCommand(checkResult);
      assertContains(checkResult.stdout, "✅ Dependencies are up to date");

      // Modify lockfile in subdirectory
      const modifiedLockfileContent =
        lockfileContent + "\n# Modified for testing";
      await writeFile(
        join(projectDir, "pnpm-lock.yaml"),
        modifiedLockfileContent
      );

      // Check should detect the change when run from subdirectory
      const checkAfterModification = await runCli("check", { cwd: projectDir });
      assertSuccessfulCommand(checkAfterModification);
      assertContains(
        checkAfterModification.stdout,
        "⚠️  DEPENDENCIES OUT OF DATE  ⚠️"
      );
      assertContains(
        checkAfterModification.stdout,
        "Lock file pnpm-lock.yaml has changed!"
      );
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle multiple Node.js projects in monorepo", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create multiple project directories
      const packagesDir = join(repo.path, "packages");
      const projectA = join(packagesDir, "project-a");
      const projectB = join(packagesDir, "project-b");

      await mkdir(packagesDir, { recursive: true });
      await mkdir(projectA, { recursive: true });
      await mkdir(projectB, { recursive: true });

      // Create package.json and lockfiles for project A (pnpm)
      const packageJsonA = {
        name: "project-a",
        version: "1.0.0",
        dependencies: { lodash: "^4.17.21" },
      };
      await writeFile(
        join(projectA, "package.json"),
        JSON.stringify(packageJsonA, null, 2)
      );

      const pnpmLockContent = `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
importers:
  .:
    dependencies:
      lodash:
        specifier: ^4.17.21
        version: 4.17.21
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-test}
snapshots:
  lodash@4.17.21: {}
`;
      await writeFile(join(projectA, "pnpm-lock.yaml"), pnpmLockContent);
      await writeFile(join(projectA, ".gitignore"), "node_modules/\n");

      // Create package.json and lockfiles for project B (npm)
      const packageJsonB = {
        name: "project-b",
        version: "1.0.0",
        dependencies: { axios: "^1.0.0" },
      };
      await writeFile(
        join(projectB, "package.json"),
        JSON.stringify(packageJsonB, null, 2)
      );

      const npmLockContent = JSON.stringify(
        {
          name: "project-b",
          version: "1.0.0",
          lockfileVersion: 3,
          requires: true,
          packages: {
            "": {
              name: "project-b",
              version: "1.0.0",
              dependencies: { axios: "^1.0.0" },
            },
            "node_modules/axios": {
              version: "1.0.0",
              resolved: "https://registry.npmjs.org/axios/-/axios-1.0.0.tgz",
              integrity: "sha512-test",
            },
          },
        },
        null,
        2
      );
      await writeFile(join(projectB, "package-lock.json"), npmLockContent);
      await writeFile(join(projectB, ".gitignore"), "node_modules/\n");

      // Commit the structure
      await repo.runCommand("git", ["add", "."]);
      await repo.runCommand("git", ["commit", "-m", "Add multiple projects"]);

      // Install from project A
      const installA = await runCli("install", { cwd: projectA });
      assertSuccessfulCommand(installA);

      // Check from project A
      const checkA = await runCli("check", { cwd: projectA });
      assertSuccessfulCommand(checkA);
      assertContains(checkA.stdout, "✅ Dependencies are up to date");

      // Initialize project B by running check (first time will initialize)
      const initB = await runCli("check", { cwd: projectB });
      assertSuccessfulCommand(initB);
      assertContains(initB.stdout, "🔒 Lockfile Guardian initialized");

      // Check from project B again (should be up to date now)
      const checkB = await runCli("check", { cwd: projectB });
      assertSuccessfulCommand(checkB);
      assertContains(checkB.stdout, "✅ Dependencies are up to date");

      // Modify lockfile in project B
      const modifiedNpmLock = JSON.stringify(
        {
          name: "project-b",
          version: "1.0.0",
          lockfileVersion: 3,
          requires: true,
          packages: {
            "": {
              name: "project-b",
              version: "1.0.0",
              dependencies: { axios: "^1.0.0" },
            },
            "node_modules/axios": {
              version: "1.0.1", // Changed version
              resolved: "https://registry.npmjs.org/axios/-/axios-1.0.1.tgz",
              integrity: "sha512-modified",
            },
          },
        },
        null,
        2
      );
      await writeFile(join(projectB, "package-lock.json"), modifiedNpmLock);

      // Check should detect change in project B
      const checkBAfterMod = await runCli("check", { cwd: projectB });
      assertSuccessfulCommand(checkBAfterMod);
      assertContains(checkBAfterMod.stdout, "⚠️  DEPENDENCIES OUT OF DATE  ⚠️");
      assertContains(checkBAfterMod.stdout, "npm install");

      // Check from project A should still be up to date
      const checkAAfterMod = await runCli("check", { cwd: projectA });
      assertSuccessfulCommand(checkAAfterMod);
      assertContains(checkAAfterMod.stdout, "✅ Dependencies are up to date");
    } finally {
      await cleanup(repo);
    }
  });

  test("should handle git hooks correctly from subdirectory", async () => {
    const repo = await createTestRepo("pnpm");

    try {
      // Create subdirectory structure
      const appDir = join(repo.path, "apps", "web");
      await mkdir(join(repo.path, "apps"), { recursive: true });
      await mkdir(appDir, { recursive: true });

      // Create package.json in subdirectory
      const packageJson = {
        name: "web-app",
        version: "1.0.0",
        dependencies: { react: "^18.0.0" },
      };
      await writeFile(
        join(appDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Create yarn lockfile
      const yarnLockContent = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
  integrity sha512-test
`;
      await writeFile(join(appDir, "yarn.lock"), yarnLockContent);
      await writeFile(join(appDir, ".gitignore"), "node_modules/\n");

      // Commit
      await repo.runCommand("git", ["add", "."]);
      await repo.runCommand("git", ["commit", "-m", "Add web app"]);

      // Install from subdirectory
      const installResult = await runCli("install", { cwd: appDir });
      assertSuccessfulCommand(installResult);

      // Verify hooks are in git root
      const hasPostMergeHook = await repo.hasHook("post-merge");
      const hasPostCheckoutHook = await repo.hasHook("post-checkout");

      assert.ok(hasPostMergeHook, "post-merge hook should be in git root");
      assert.ok(
        hasPostCheckoutHook,
        "post-checkout hook should be in git root"
      );

      // Test uninstall from subdirectory
      const uninstallResult = await runCli("uninstall", { cwd: appDir });
      assertSuccessfulCommand(uninstallResult);
      assertContains(
        uninstallResult.stdout,
        "🔒 Lockfile Guardian uninstalled successfully"
      );

      // Verify hooks are removed from git root
      const hasPostMergeAfterUninstall = await repo.hasHook("post-merge");
      const hasPostCheckoutAfterUninstall = await repo.hasHook("post-checkout");

      assert.ok(
        !hasPostMergeAfterUninstall,
        "post-merge hook should be removed"
      );
      assert.ok(
        !hasPostCheckoutAfterUninstall,
        "post-checkout hook should be removed"
      );
    } finally {
      await cleanup(repo);
    }
  });
});
