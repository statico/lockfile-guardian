import { test, describe } from "node:test";
import { strict as assert } from "assert";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync } from "fs";

// Import the guardian functions to test
import {
  storeCurrentHash,
  getStoredHash,
  clearStoredHash,
  updateHashAfterInstall,
} from "../../dist/guardian.js";

describe("Guardian Module", () => {
  let tempDir;

  const createLockfile = async (tempDir, type = "pnpm", content = null) => {
    const lockfiles = {
      pnpm: {
        file: "pnpm-lock.yaml",
        content: content || "lockfileVersion: '9.0'",
      },
      yarn: { file: "yarn.lock", content: content || "# yarn lockfile v1" },
      npm: {
        file: "package-lock.json",
        content: content || '{"lockfileVersion": 3}',
      },
    };

    const lockfile = lockfiles[type];
    await writeFile(join(tempDir, lockfile.file), lockfile.content);
  };

  const createGitDir = async (tempDir) => {
    await mkdir(join(tempDir, ".git"));
  };

  describe("storeCurrentHash", () => {
    test("should store hash for pnpm lockfile", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir, "pnpm");

      storeCurrentHash(tempDir);

      const storedHash = getStoredHash(tempDir);
      assert.ok(storedHash, "Should store hash");
      assert.strictEqual(storedHash.length, 64, "Should store SHA256 hash");

      await rm(tempDir, { recursive: true });
    });

    test("should store hash for yarn lockfile", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir, "yarn");

      storeCurrentHash(tempDir);

      const storedHash = getStoredHash(tempDir);
      assert.ok(storedHash, "Should store hash");

      await rm(tempDir, { recursive: true });
    });

    test("should store hash for npm lockfile", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir, "npm");

      storeCurrentHash(tempDir);

      const storedHash = getStoredHash(tempDir);
      assert.ok(storedHash, "Should store hash");

      await rm(tempDir, { recursive: true });
    });

    test("should not store hash when no lockfile present", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      storeCurrentHash(tempDir);

      const storedHash = getStoredHash(tempDir);
      assert.strictEqual(
        storedHash,
        null,
        "Should not store hash without lockfile"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should update hash when lockfile changes", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(
        tempDir,
        "pnpm",
        "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true"
      );

      storeCurrentHash(tempDir);
      const firstHash = getStoredHash(tempDir);

      // Change lockfile content
      await createLockfile(
        tempDir,
        "pnpm",
        "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: false"
      );

      storeCurrentHash(tempDir);
      const secondHash = getStoredHash(tempDir);

      assert.notStrictEqual(
        firstHash,
        secondHash,
        "Hash should change when lockfile changes"
      );

      await rm(tempDir, { recursive: true });
    });
  });

  describe("getStoredHash", () => {
    test("should return null when no hash stored", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      const hash = getStoredHash(tempDir);
      assert.strictEqual(hash, null);

      await rm(tempDir, { recursive: true });
    });

    test("should return stored hash", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir);

      storeCurrentHash(tempDir);
      const hash = getStoredHash(tempDir);

      assert.ok(hash, "Should return stored hash");
      assert.strictEqual(typeof hash, "string");
      assert.strictEqual(hash.length, 64);

      await rm(tempDir, { recursive: true });
    });

    test("should handle corrupted data file gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      // Create corrupted data file
      const dataPath = join(tempDir, ".git", "lockfile-guardian");
      await writeFile(dataPath, "corrupted-hash-data");

      const hash = getStoredHash(tempDir);
      assert.strictEqual(hash, "corrupted-hash-data");

      await rm(tempDir, { recursive: true });
    });
  });

  describe("clearStoredHash", () => {
    test("should remove stored hash file", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir);

      storeCurrentHash(tempDir);
      assert.ok(getStoredHash(tempDir), "Hash should be stored");

      clearStoredHash(tempDir);
      assert.strictEqual(
        getStoredHash(tempDir),
        null,
        "Hash should be cleared"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should handle missing hash file gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      // Should not throw error when file doesn't exist
      assert.doesNotThrow(() => clearStoredHash(tempDir));

      await rm(tempDir, { recursive: true });
    });
  });

  describe("updateHashAfterInstall", () => {
    test("should update hash after install with pnpm lockfile", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir, "pnpm");

      // Store initial hash
      storeCurrentHash(tempDir);
      const initialHash = getStoredHash(tempDir);

      // Change lockfile (simulating install)
      await createLockfile(
        tempDir,
        "pnpm",
        "lockfileVersion: '9.0'\npackages:\n  'lodash@4.17.21': {}"
      );

      // Update hash after install
      updateHashAfterInstall(tempDir);
      const updatedHash = getStoredHash(tempDir);

      assert.notStrictEqual(initialHash, updatedHash, "Hash should be updated");

      await rm(tempDir, { recursive: true });
    });

    test("should handle missing lockfile gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      // Should not throw error when no lockfile
      assert.doesNotThrow(() => updateHashAfterInstall(tempDir));

      await rm(tempDir, { recursive: true });
    });

    test("should work with different package managers", async () => {
      for (const packageManager of ["pnpm", "yarn", "npm"]) {
        tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
        await createGitDir(tempDir);
        await createLockfile(tempDir, packageManager);

        updateHashAfterInstall(tempDir);
        const hash = getStoredHash(tempDir);

        assert.ok(hash, `Should store hash for ${packageManager}`);

        await rm(tempDir, { recursive: true });
      }
    });

    test("should create package.json config for silent mode", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir);

      // Create package.json with silent config
      const packageJson = {
        name: "test",
        lockfileGuardian: {
          silent: true,
        },
      };
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson)
      );

      // Should not throw error in silent mode
      assert.doesNotThrow(() => updateHashAfterInstall(tempDir));

      await rm(tempDir, { recursive: true });
    });
  });

  describe("hash consistency", () => {
    test("should generate same hash for same lockfile content", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      const lockfileContent =
        "lockfileVersion: '9.0'\npackages:\n  'test@1.0.0': {}";
      await createLockfile(tempDir, "pnpm", lockfileContent);

      storeCurrentHash(tempDir);
      const hash1 = getStoredHash(tempDir);

      // Remove and recreate same lockfile
      await rm(join(tempDir, "pnpm-lock.yaml"));
      await createLockfile(tempDir, "pnpm", lockfileContent);

      storeCurrentHash(tempDir);
      const hash2 = getStoredHash(tempDir);

      assert.strictEqual(
        hash1,
        hash2,
        "Same content should generate same hash"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should generate different hash for different lockfile content", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);

      await createLockfile(tempDir, "pnpm", "lockfileVersion: '9.0'");
      storeCurrentHash(tempDir);
      const hash1 = getStoredHash(tempDir);

      await createLockfile(
        tempDir,
        "pnpm",
        "lockfileVersion: '9.0'\npackages: {}"
      );
      storeCurrentHash(tempDir);
      const hash2 = getStoredHash(tempDir);

      assert.notStrictEqual(
        hash1,
        hash2,
        "Different content should generate different hash"
      );

      await rm(tempDir, { recursive: true });
    });
  });

  describe("data file location", () => {
    test("should store data in .git directory", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "guardian-test-"));
      await createGitDir(tempDir);
      await createLockfile(tempDir);

      storeCurrentHash(tempDir);

      const dataPath = join(tempDir, ".git", "lockfile-guardian");
      assert.ok(
        existsSync(dataPath),
        "Should create data file in .git directory"
      );

      await rm(tempDir, { recursive: true });
    });
  });
});
