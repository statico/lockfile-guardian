import { test, describe } from "node:test";
import { strict as assert } from "assert";
import { writeFile, readFile, rm } from "fs/promises";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Import the post-install functions to test
import {
  installPostInstallHook,
  uninstallPostInstallHook,
  isPostInstallHookInstalled,
  runPostInstallHook,
} from "../../dist/post-install.js";

describe("Post-Install Module", () => {
  let tempDir;

  const createBasicPackageJson = (scripts = {}) => ({
    name: "test-project",
    version: "1.0.0",
    scripts,
  });

  const createLockfile = async (tempDir, type = "pnpm") => {
    const lockfiles = {
      pnpm: { file: "pnpm-lock.yaml", content: "lockfileVersion: '9.0'" },
      yarn: { file: "yarn.lock", content: "# yarn lockfile v1" },
      npm: { file: "package-lock.json", content: '{"lockfileVersion": 3}' },
    };

    const lockfile = lockfiles[type];
    await writeFile(join(tempDir, lockfile.file), lockfile.content);
  };

  describe("installPostInstallHook", () => {
    test("should add postinstall script to empty package.json", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson();
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );
      await createLockfile(tempDir);

      installPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.ok(updated.scripts, "Should have scripts object");
      assert.strictEqual(
        updated.scripts.postinstall,
        "npx lockfile-guardian post-install",
        "Should add postinstall script"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should append to existing postinstall script", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "echo existing",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );
      await createLockfile(tempDir);

      installPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.strictEqual(
        updated.scripts.postinstall,
        "echo existing && npx lockfile-guardian post-install",
        "Should append to existing script"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should not duplicate hook if already present", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "npx lockfile-guardian post-install",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );
      await createLockfile(tempDir);

      installPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.strictEqual(
        updated.scripts.postinstall,
        "npx lockfile-guardian post-install",
        "Should not duplicate hook"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should create scripts object if it doesn't exist", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = { name: "test-project", version: "1.0.0" };
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );
      await createLockfile(tempDir);

      installPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.ok(updated.scripts, "Should create scripts object");
      assert.strictEqual(
        updated.scripts.postinstall,
        "npx lockfile-guardian post-install"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should throw error when package.json not found", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      assert.throws(
        () => installPostInstallHook(tempDir),
        /package.json not found/,
        "Should throw error when package.json missing"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should throw error when package.json is invalid", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      await writeFile(join(tempDir, "package.json"), "invalid json");

      assert.throws(
        () => installPostInstallHook(tempDir),
        /Failed to read or parse package.json/,
        "Should throw error for invalid JSON"
      );

      await rm(tempDir, { recursive: true });
    });
  });

  describe("uninstallPostInstallHook", () => {
    test("should remove hook from postinstall script", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "npx lockfile-guardian post-install",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      uninstallPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.ok(
        !updated.scripts.postinstall,
        "Should remove postinstall script"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should remove hook but keep other commands in postinstall script", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "echo existing && npx lockfile-guardian post-install",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      uninstallPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.strictEqual(
        updated.scripts.postinstall,
        "echo existing",
        "Should remove only our hook"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should handle hook at beginning of compound command", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "npx lockfile-guardian post-install && echo after",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      uninstallPostInstallHook(tempDir);

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.strictEqual(
        updated.scripts.postinstall,
        "echo after",
        "Should remove hook from beginning"
      );

      await rm(tempDir, { recursive: true });
    });

    test("should handle missing package.json gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      // Should not throw error
      assert.doesNotThrow(() => uninstallPostInstallHook(tempDir));

      await rm(tempDir, { recursive: true });
    });

    test("should handle missing postinstall script gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson();
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Should not throw error
      assert.doesNotThrow(() => uninstallPostInstallHook(tempDir));

      await rm(tempDir, { recursive: true });
    });

    test("should handle hook not present gracefully", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "echo other command",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      // Should not throw error
      assert.doesNotThrow(() => uninstallPostInstallHook(tempDir));

      const updatedContent = await readFile(
        join(tempDir, "package.json"),
        "utf8"
      );
      const updated = JSON.parse(updatedContent);

      assert.strictEqual(
        updated.scripts.postinstall,
        "echo other command",
        "Should leave other commands unchanged"
      );

      await rm(tempDir, { recursive: true });
    });
  });

  describe("isPostInstallHookInstalled", () => {
    test("should return true when hook is installed", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "npx lockfile-guardian post-install",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, true);

      await rm(tempDir, { recursive: true });
    });

    test("should return true when hook is part of compound command", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall:
          "echo before && npx lockfile-guardian post-install && echo after",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, true);

      await rm(tempDir, { recursive: true });
    });

    test("should return false when hook is not installed", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson({
        postinstall: "echo other command",
      });
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, false);

      await rm(tempDir, { recursive: true });
    });

    test("should return false when no postinstall script exists", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = createBasicPackageJson();
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, false);

      await rm(tempDir, { recursive: true });
    });

    test("should return false when no scripts object exists", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const packageJson = { name: "test-project", version: "1.0.0" };
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, false);

      await rm(tempDir, { recursive: true });
    });

    test("should return false when package.json doesn't exist", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, false);

      await rm(tempDir, { recursive: true });
    });

    test("should return false when package.json is invalid", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      await writeFile(join(tempDir, "package.json"), "invalid json");

      const result = isPostInstallHookInstalled(tempDir);
      assert.strictEqual(result, false);

      await rm(tempDir, { recursive: true });
    });
  });

  describe("runPostInstallHook", () => {
    test("should not throw error when called with valid lockfile", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      await createLockfile(tempDir);

      // Should not throw
      assert.doesNotThrow(() => runPostInstallHook(tempDir));

      await rm(tempDir, { recursive: true });
    });

    test("should not throw error when called without lockfile", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "post-install-test-"));

      // Should not throw even without lockfile
      assert.doesNotThrow(() => runPostInstallHook(tempDir));

      await rm(tempDir, { recursive: true });
    });
  });
});
