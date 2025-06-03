import { strict as assert } from "assert";

export function assertExitCode(result, expectedCode, message = "") {
  const fullMessage = message ? `${message}: ` : "";
  assert.strictEqual(
    result.exitCode,
    expectedCode,
    `${fullMessage}Expected exit code ${expectedCode}, got ${result.exitCode}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`
  );
}

export function assertContains(text, substring, message = "") {
  const fullMessage = message ? `${message}: ` : "";
  assert(
    text.includes(substring),
    `${fullMessage}Expected text to contain "${substring}".\nActual text: ${text}`
  );
}

export function assertNotContains(text, substring, message = "") {
  const fullMessage = message ? `${message}: ` : "";
  assert(
    !text.includes(substring),
    `${fullMessage}Expected text to NOT contain "${substring}".\nActual text: ${text}`
  );
}

export function assertStartsWith(text, prefix, message = "") {
  const fullMessage = message ? `${message}: ` : "";
  assert(
    text.startsWith(prefix),
    `${fullMessage}Expected text to start with "${prefix}".\nActual text: ${text}`
  );
}

export function assertMatches(text, pattern, message = "") {
  const fullMessage = message ? `${message}: ` : "";
  assert(
    pattern.test(text),
    `${fullMessage}Expected text to match pattern ${pattern}.\nActual text: ${text}`
  );
}

export function assertSuccessfulCommand(result, message = "") {
  assertExitCode(result, 0, message || "Command should succeed");
}

export function assertFailedCommand(result, message = "") {
  assert.notStrictEqual(
    result.exitCode,
    0,
    `${message || "Command should fail"}.\nStdout: ${result.stdout}\nStderr: ${
      result.stderr
    }`
  );
}

export function assertHookInstalled(repo, hookName) {
  return repo.hasHook(hookName).then((hasHook) => {
    assert(hasHook, `Git hook ${hookName} should be installed`);
  });
}

export function assertHookNotInstalled(repo, hookName) {
  return repo.hasHook(hookName).then((hasHook) => {
    assert(!hasHook, `Git hook ${hookName} should NOT be installed`);
  });
}

export function assertGuardianDataExists(repo) {
  return repo.hasGuardianData().then((hasData) => {
    assert(hasData, "Guardian data file should exist");
  });
}

export function assertGuardianDataNotExists(repo) {
  return repo.hasGuardianData().then((hasData) => {
    assert(!hasData, "Guardian data file should NOT exist");
  });
}
