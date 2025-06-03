# 🔒 Lockfile Guardian

Never forget to install dependencies again! Automatically detect when your lock files change after git operations and warn you (or auto-install) when your dependencies are out of sync.

## The Problem

You know this scenario:
- Teammate adds a new dependency
- You `git pull` or switch branches
- Your code breaks because you forgot to run `npm install`
- You spend 10 minutes debugging before realizing the issue

## The Solution

Lockfile Guardian installs git hooks that automatically detect when your lock files have changed and either warn you or auto-install dependencies.

## Features

- 🎯 **Zero runtime dependencies** - Pure Node.js implementation
- 🔍 **Smart detection** - Auto-detects npm, yarn, or pnpm lock files
- ⚡ **One-command setup** - `npx lockfile-guardian install` and you're done
- 🪝 **Git hooks** - Works on checkout, pull, merge, and branch switching
- 🔧 **Configurable** - Optional auto-install and silent modes
- 📦 **TypeScript** - Built with TypeScript, works with any Node.js project
- 🧹 **Clean** - Stores metadata in `.git/` directory, not your working tree
- ⚠️ **Visual warnings** - Eye-catching alerts when dependencies are out of sync

## Quick Start

```bash
# Install and setup git hooks (one time only)
npx lockfile-guardian install

# That's it! Now every git operation checks your dependencies
```

## How It Works

1. **Secure tracking** - Stores SHA256 hash of your lock file in `.git/lockfile-guardian`
2. **Git integration** - Installs hooks for post-checkout, post-merge, and post-rewrite
3. **Smart detection** - Automatically finds and monitors the right lock file
4. **Helpful warnings** - Shows exactly which command to run for your package manager
5. **Optional automation** - Can automatically install dependencies if configured

## Configuration

Add optional configuration to your `package.json`:

```json
{
  "lockfileGuardian": {
    "autoInstall": true,    // Automatically run install commands
    "silent": false,        // Suppress non-warning output
    "checkNodeModules": true // Warn if node_modules isn't gitignored (default: true)
  }
}
```

## Commands

```bash
# Setup git hooks (one-time setup)
npx lockfile-guardian install

# Remove all hooks and cleanup
npx lockfile-guardian uninstall

# Manually check for lock file changes
npx lockfile-guardian check

# Show help and current configuration
npx lockfile-guardian
```

## Supported Package Managers

Automatically detects and supports:

- **pnpm** - `pnpm-lock.yaml` → `pnpm install`
- **Yarn** - `yarn.lock` → `yarn install`
- **npm** - `package-lock.json` → `npm install`

Detection priority: pnpm → yarn → npm (first lock file found wins)

## Example Output

### Basic Warning
```bash
$ git checkout feature/new-deps
=====================================
⚠️  DEPENDENCIES OUT OF DATE  ⚠️
=====================================
Lock file pnpm-lock.yaml has changed!

Run this command to update:
  pnpm install
=====================================
```

### With Auto-Install
```bash
$ git pull origin main
🔒 Lock file yarn.lock has changed!
🔒 Auto-installing dependencies with yarn...
yarn install v1.22.19
[1/4] 🔍  Resolving packages...
[2/4] 🚚  Fetching packages...
[3/4] 🔗  Linking dependencies...
[4/4] 🔨  Building fresh packages...
✨ Done in 2.34s.
🔒 Dependencies updated successfully!
```

## What Gets Created

**Git hooks:**
- `.git/hooks/post-checkout` - Runs after branch switching
- `.git/hooks/post-merge` - Runs after `git pull`/`git merge`
- `.git/hooks/post-rewrite` - Runs after `git rebase`

**Metadata:**
- `.git/lockfile-guardian` - Stores hash of current lock file

**Nothing in your working directory!** All tool data stays in `.git/` where it belongs.

## Safety Features

- **Non-destructive** - Only reads lock files, never modifies them
- **Git validation** - Ensures you're in a git repository before installing
- **Gitignore check** - Warns if `node_modules` isn't properly ignored
- **Safe uninstall** - Completely removes all traces when uninstalled
- **Error handling** - Graceful failure if install commands fail

## Why Use This?

**For individuals:**
- Never waste time debugging dependency issues again
- Automatic detection works seamlessly in the background
- Zero maintenance after initial setup

**For teams:**
- Ensures everyone has the same dependencies installed
- Prevents "works on my machine" issues
- Catches dependency updates immediately after pulling changes
- Reduces onboarding friction for new team members

## Comparison with Alternatives

| Tool | Setup | Auto-install | Zero deps | Git integrated |
|------|--------|-------------|-----------|----------------|
| **Lockfile Guardian** | ✅ One command | ✅ Optional | ✅ Yes | ✅ Native hooks |
| `@antfu/ni` | ❌ Manual usage | ❌ Manual | ❌ No | ❌ No |
| Manual git hooks | ❌ Complex setup | ❌ Script required | ✅ Yes | ✅ Yes |
| IDE extensions | ❌ Per-editor setup | ❌ Usually not | ❌ No | ❌ No |

## Requirements

- Node.js 14+
- Git repository
- One of: npm, yarn, or pnpm

## Contributing

This tool is designed to be simple and focused. If you have ideas for improvements, please open an issue to discuss before implementing major changes.

## License

MIT