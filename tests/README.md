# 🧪 Lockfile Guardian Test Suite

This directory contains comprehensive tests for the Lockfile Guardian project using Node.js built-in test runner with custom integration test framework.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   └── utils.test.js       # Tests for utility functions
├── integration/             # Full workflow tests
│   ├── install-flow.test.js     # Installation command tests
│   ├── check-flow.test.js       # Check command and detection tests
│   ├── uninstall-flow.test.js   # Uninstall command tests
│   └── cli-commands.test.js     # CLI interface tests
└── helpers/                 # Test utilities
    ├── test-repo.js        # Git repo creation/cleanup utilities
    └── assertions.js       # Custom assertion functions
```

## Test Categories

### Unit Tests (11 tests)

- **SHA256 hashing** - Consistent hash generation
- **Package manager detection** - pnpm/yarn/npm lockfile detection
- **Priority handling** - Correct package manager precedence
- **Git repository detection** - .git directory validation
- **Configuration loading** - package.json configuration parsing
- **Gitignore checking** - node_modules gitignore validation

### Integration Tests (36 tests)

#### Install Flow (8 tests)

- ✅ Git hooks installation for all package managers
- ✅ Error handling for non-git repositories
- ✅ Error handling for missing lockfiles
- ✅ Existing hook preservation
- ✅ Duplicate installation prevention
- ✅ Guardian data initialization

#### Check Flow (10 tests)

- ✅ Change detection and warning display
- ✅ Package manager specific install commands
- ✅ Silent mode configuration
- ✅ Hook mode operation (--hook flag)
- ✅ Git branch switching scenarios
- ✅ Node modules gitignore warnings
- ✅ First-time initialization

#### Uninstall Flow (7 tests)

- ✅ Complete hook and data removal
- ✅ Existing hook content preservation
- ✅ Graceful handling of missing components
- ✅ Non-git repository handling
- ✅ Partial installation cleanup

#### CLI Commands (11 tests)

- ✅ Help display (--help, -h, help command)
- ✅ Status display with different configurations
- ✅ Package manager specific status
- ✅ Error state display
- ✅ Version information
- ✅ Unknown command handling

## Running Tests

```bash
# Run all tests
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run tests with file watching
pnpm test:watch
```

## Test Infrastructure

### TestRepo Class

The `TestRepo` class provides a complete testing environment:

- **Temporary git repositories** - Isolated test environments
- **Package manager simulation** - Creates appropriate lockfiles
- **Git operations** - Branch creation, commits, merges
- **Hook management** - Hook installation verification
- **File operations** - Read/write test files
- **Command execution** - Run git and CLI commands

### Custom Assertions

Specialized assertion functions for lockfile guardian:

- `assertSuccessfulCommand()` - Verify command success
- `assertContains()` - Text content verification
- `assertHookInstalled()` - Git hook verification
- `assertGuardianDataExists()` - Data file verification

### Cleanup Strategy

Every test ensures:

- ✅ Temporary directories are cleaned up
- ✅ No test artifacts left behind
- ✅ Tests are completely isolated
- ✅ No interference between test runs

## Test Coverage

The test suite covers:

- **✅ All CLI commands** (install, uninstall, check, help, status)
- **✅ All package managers** (pnpm, yarn, npm)
- **✅ All configuration options** (autoInstall, silent, checkNodeModules)
- **✅ Error conditions** (missing files, non-git repos, invalid states)
- **✅ Edge cases** (existing hooks, partial installations, multiple lockfiles)
- **✅ Git operations** (branch switching, commits, merges)
- **✅ File system operations** (hash calculations, file detection)

## Performance

- **Fast execution** - Parallel test execution where possible
- **Efficient cleanup** - Quick temporary directory management
- **Minimal overhead** - No heavy test framework dependencies
- **Isolated environments** - Each test runs in fresh temporary directory

## Debugging Tests

To debug failing tests:

```bash
# Run specific test file
node --test tests/integration/install-flow.test.js

# Add debug logging in test helpers
# See test-repo.js for command output capture

# Check test artifacts (temporary directories are cleaned up automatically)
# Modify cleanup() calls in tests to skip cleanup for inspection
```

## Adding New Tests

1. **Unit tests** - Add to `tests/unit/` for individual function testing
2. **Integration tests** - Add to `tests/integration/` for workflow testing
3. **Use helpers** - Leverage `TestRepo` and assertion helpers
4. **Follow patterns** - Use existing test structure and naming
5. **Clean up** - Always use try/finally with cleanup()

Example test structure:

```javascript
test("should do something", async () => {
  const repo = await createTestRepo("pnpm");

  try {
    // Test setup
    // Test execution
    // Assertions
  } finally {
    await cleanup(repo);
  }
});
```
