import { test, describe } from "node:test";
import { strict as assert } from "assert";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Import functions to test
import {
  installPostInstallHook,
  runPostInstallHook,
  isPostInstallHookInstalled,
} from "../../dist/post-install.js";
import {
  storeCurrentHash,
  getStoredHash,
  clearStoredHash,
} from "../../dist/guardian.js";

describe("Post-Install Workflow Integration", () => {
  let tempDir;

  const createGitDir = async (tempDir) => {
    await mkdir(join(tempDir, ".git"));
  };

  const createPackageJson = async (tempDir, scripts = {}) => {
    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      scripts,
      dependencies: {
        lodash: "^4.17.21",
      },
    };
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
  };

  const createLockfile = async (tempDir, withDependencies = false) => {
    const content = withDependencies
      ? `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true

packages:
  'lodash@4.17.21':
    resolution: {integrity: sha512-example}
    engines: {node: '>=0.1.0'}`
      : "lockfileVersion: '9.0'";

    await writeFile(join(tempDir, "pnpm-lock.yaml"), content);
  };

  describe("Complete post-install workflow", () => {
    test("should track lockfile changes only after package installs", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
      await createGitDir(tempDir);
      await createPackageJson(tempDir);
      await createLockfile(tempDir);

      // Step 1: Install post-install hook
      installPostInstallHook(tempDir);

      // Verify hook is installed
      assert.ok(
        isPostInstallHookInstalled(tempDir),
        "Post-install hook should be installed"
      );

      // Verify package.json is updated
      const packageJsonContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const packageJson = JSON.parse(packageJsonContent);
      assert.ok(
        packageJson.scripts.postinstall.includes(
          "npx lockfile-guardian post-install"
        ),
        "Should add post-install hook to package.json"
      );

      // Step 2: Initialize with current lockfile hash
      storeCurrentHash(tempDir);
      const initialHash = getStoredHash(tempDir);
      assert.ok(initialHash, "Should store initial hash");

      // Step 3: Simulate lockfile change (like switching branches)
      await createLockfile(tempDir, true); // Add dependencies
      const newHash = getStoredHash(tempDir);

      // Hash should still be the old one since we haven't "installed"
      assert.strictEqual(
        newHash,
        initialHash,
        "Stored hash should not change on lockfile change"
      );

      // Step 4: Simulate running package install (which triggers post-install hook)
      runPostInstallHook(tempDir);
      const updatedHash = getStoredHash(tempDir);

      // Now hash should be updated
      assert.notStrictEqual(
        updatedHash,
        initialHash,
        "Hash should be updated after install"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should work with existing postinstall scripts", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
      await createGitDir(tempDir);
      await createPackageJson(tempDir, {
        postinstall: "echo 'Custom post-install'",
      });
      await createLockfile(tempDir);

      // Install our hook
      installPostInstallHook(tempDir);

      // Verify both scripts are present
      const packageJsonContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const packageJson = JSON.parse(packageJsonContent);

      assert.ok(
        packageJson.scripts.postinstall.includes("echo 'Custom post-install'"),
        "Should preserve existing script"
      );
      assert.ok(
        packageJson.scripts.postinstall.includes(
          "npx lockfile-guardian post-install"
        ),
        "Should add our hook"
      );

      // Store initial hash
      storeCurrentHash(tempDir);
      const initialHash = getStoredHash(tempDir);

      // Change lockfile and run post-install
      await createLockfile(tempDir, true);
      runPostInstallHook(tempDir);

      // Hash should be updated
      const updatedHash = getStoredHash(tempDir);
      assert.notStrictEqual(updatedHash, initialHash, "Hash should be updated");

      await rm(tempDir, { recursive: true });
    });

    test("should handle multiple install cycles correctly", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
      await createGitDir(tempDir);
      await createPackageJson(tempDir);
      await createLockfile(tempDir);

      installPostInstallHook(tempDir);
      storeCurrentHash(tempDir);

      const hashes = [getStoredHash(tempDir)];

      // Simulate 3 install cycles with different lockfile states
      for (let i = 1; i <= 3; i++) {
        // Change lockfile
        const content = `lockfileVersion: '9.0'\nversion: ${i}`;
        await writeFile(join(tempDir, "pnpm-lock.yaml"), content);

        // Run post-install hook
        runPostInstallHook(tempDir);

        // Store new hash
        const newHash = getStoredHash(tempDir);
        hashes.push(newHash);

        // Each hash should be different
        assert.notStrictEqual(
          newHash,
          hashes[i - 1],
          `Hash ${i} should be different from previous`
        );
      }

      // All hashes should be unique
      const uniqueHashes = [...new Set(hashes)];
      assert.strictEqual(
        uniqueHashes.length,
        hashes.length,
        "All hashes should be unique"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should work with different package managers", async () => {
      const packageManagers = [
        {
          name: "pnpm",
          file: "pnpm-lock.yaml",
          content: "lockfileVersion: '9.0'",
        },
        { name: "yarn", file: "yarn.lock", content: "# yarn lockfile v1" },
        {
          name: "npm",
          file: "package-lock.json",
          content: '{"lockfileVersion": 3}',
        },
      ];

      for (const pm of packageManagers) {
        tempDir = await mkdtemp(join(tmpdir(), `integration-test-${pm.name}-`));
        await createGitDir(tempDir);
        await createPackageJson(tempDir);
        await writeFile(join(tempDir, pm.file), pm.content);

        installPostInstallHook(tempDir);
        storeCurrentHash(tempDir);
        const initialHash = getStoredHash(tempDir);

        // Change lockfile
        const updatedContent = pm.content + "\n# Updated";
        await writeFile(join(tempDir, pm.file), updatedContent);

        runPostInstallHook(tempDir);
        const updatedHash = getStoredHash(tempDir);

        assert.notStrictEqual(
          updatedHash,
          initialHash,
          `Hash should be updated for ${pm.name}`
        );

        await rm(tempDir, { recursive: true });
      }
    });

    test("should handle configuration options", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir);

      // Create package.json with config
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        lockfileGuardian: {
          silent: true,
          checkNodeModules: false,
        },
      };
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      installPostInstallHook(tempDir);
      storeCurrentHash(tempDir);

      // Change lockfile and run hook
      await createLockfile(tempDir, true);

      // Should not throw with silent mode
      assert.doesNotThrow(() => runPostInstallHook(tempDir));

      // Hash should still be updated
      const finalHash = getStoredHash(tempDir);
      assert.ok(finalHash, "Should update hash even in silent mode");

      await rm(tempDir, { recursive: true });
    });
  });

  describe("Error handling", () => {
    test("should handle missing .git directory gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
      await createPackageJson(tempDir);
      await createLockfile(tempDir);

      installPostInstallHook(tempDir);

      // Should not throw error when .git directory doesn't exist
      assert.doesNotThrow(() => runPostInstallHook(tempDir));

      await rm(tempDir, { recursive: true });
    });

    test("should handle missing lockfile gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
      await createGitDir(tempDir);
      await createPackageJson(tempDir);

      installPostInstallHook(tempDir);

      // Should not throw error when lockfile doesn't exist
      assert.doesNotThrow(() => runPostInstallHook(tempDir));

      await rm(tempDir, { recursive: true });
    });
  });
});
