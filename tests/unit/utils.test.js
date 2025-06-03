import { test, describe } from "node:test";
import { strict as assert } from "assert";
import { writeFile, mkdir, rm } from "fs/promises";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Import the utils to test
import {
  createSHA256Hash,
  findLockfile,
  isGitRepository,
  loadConfig,
  isNodeModulesIgnored,
  PACKAGE_MANAGERS,
} from "../../dist/utils.js";

describe("Utils Module", () => {
  let tempDir;

  test("should create consistent SHA256 hashes", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));
    const testFile = join(tempDir, "test.txt");
    const content = "Hello, World!";

    await writeFile(testFile, content);

    const hash1 = createSHA256Hash(testFile);
    const hash2 = createSHA256Hash(testFile);

    assert.strictEqual(hash1, hash2, "Same file should produce same hash");
    assert.strictEqual(hash1.length, 64, "SHA256 hash should be 64 characters");
    assert.match(hash1, /^[a-f0-9]+$/, "Hash should be hexadecimal");

    await rm(tempDir, { recursive: true });
  });

  test("should detect pnpm lockfile", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    const lockfileContent = `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true`;

    await writeFile(join(tempDir, "pnpm-lock.yaml"), lockfileContent);

    const result = findLockfile(tempDir);

    assert.ok(result, "Should find lockfile");
    assert.strictEqual(result.packageManager.name, "pnpm");
    assert.strictEqual(result.packageManager.lockFile, "pnpm-lock.yaml");
    assert.strictEqual(result.packageManager.installCommand, "pnpm install");
    assert.ok(result.hash, "Should have hash");

    await rm(tempDir, { recursive: true });
  });

  test("should detect yarn lockfile", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    const lockfileContent = `# yarn lockfile v1
lodash@^4.17.21:
  version "4.17.21"`;

    await writeFile(join(tempDir, "yarn.lock"), lockfileContent);

    const result = findLockfile(tempDir);

    assert.ok(result, "Should find lockfile");
    assert.strictEqual(result.packageManager.name, "yarn");
    assert.strictEqual(result.packageManager.lockFile, "yarn.lock");
    assert.strictEqual(result.packageManager.installCommand, "yarn install");

    await rm(tempDir, { recursive: true });
  });

  test("should detect npm lockfile", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    const lockfileContent = JSON.stringify({
      name: "test",
      lockfileVersion: 3,
    });

    await writeFile(join(tempDir, "package-lock.json"), lockfileContent);

    const result = findLockfile(tempDir);

    assert.ok(result, "Should find lockfile");
    assert.strictEqual(result.packageManager.name, "npm");
    assert.strictEqual(result.packageManager.lockFile, "package-lock.json");
    assert.strictEqual(result.packageManager.installCommand, "npm install");

    await rm(tempDir, { recursive: true });
  });

  test("should prioritize pnpm over yarn over npm", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    // Create all three lockfiles
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "lockfileVersion: 9.0");
    await writeFile(join(tempDir, "yarn.lock"), "# yarn lockfile v1");
    await writeFile(
      join(tempDir, "package-lock.json"),
      '{"lockfileVersion": 3}'
    );

    const result = findLockfile(tempDir);

    assert.ok(result, "Should find lockfile");
    assert.strictEqual(
      result.packageManager.name,
      "pnpm",
      "Should prioritize pnpm"
    );

    await rm(tempDir, { recursive: true });
  });

  test("should return null when no lockfile found", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    const result = findLockfile(tempDir);

    assert.strictEqual(result, null);

    await rm(tempDir, { recursive: true });
  });

  test("should detect git repository", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    // Not a git repo initially
    assert.strictEqual(isGitRepository(tempDir), false);

    // Create .git directory
    await mkdir(join(tempDir, ".git"));

    // Now it should be detected as a git repo
    assert.strictEqual(isGitRepository(tempDir), true);

    await rm(tempDir, { recursive: true });
  });

  test("should load default config when no package.json", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    const config = loadConfig(tempDir);

    assert.deepStrictEqual(config, { checkNodeModules: true });

    await rm(tempDir, { recursive: true });
  });

  test("should load config from package.json", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    const packageJson = {
      name: "test",
      lockfileGuardian: {
        autoInstall: true,
        silent: true,
        checkNodeModules: false,
      },
    };

    await writeFile(join(tempDir, "package.json"), JSON.stringify(packageJson));

    const config = loadConfig(tempDir);

    assert.deepStrictEqual(config, {
      checkNodeModules: false,
      autoInstall: true,
      silent: true,
    });

    await rm(tempDir, { recursive: true });
  });

  test("should detect when node_modules is gitignored", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "utils-test-"));

    // No .gitignore initially
    assert.strictEqual(isNodeModulesIgnored(tempDir), false);

    // Create .gitignore with node_modules
    await writeFile(join(tempDir, ".gitignore"), "node_modules/\n*.log\n");

    assert.strictEqual(isNodeModulesIgnored(tempDir), true);

    await rm(tempDir, { recursive: true });
  });

  test("should have correct package manager configurations", () => {
    assert.strictEqual(PACKAGE_MANAGERS.length, 3);

    const pnpmConfig = PACKAGE_MANAGERS.find((pm) => pm.name === "pnpm");
    assert.ok(pnpmConfig);
    assert.strictEqual(pnpmConfig.lockFile, "pnpm-lock.yaml");
    assert.strictEqual(pnpmConfig.installCommand, "pnpm install");

    const yarnConfig = PACKAGE_MANAGERS.find((pm) => pm.name === "yarn");
    assert.ok(yarnConfig);
    assert.strictEqual(yarnConfig.lockFile, "yarn.lock");
    assert.strictEqual(yarnConfig.installCommand, "yarn install");

    const npmConfig = PACKAGE_MANAGERS.find((pm) => pm.name === "npm");
    assert.ok(npmConfig);
    assert.strictEqual(npmConfig.lockFile, "package-lock.json");
    assert.strictEqual(npmConfig.installCommand, "npm install");
  });
});
