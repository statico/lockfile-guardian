# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2024-12-19

### Added
- **Monorepo Support**: lockfile-guardian now works correctly when Node.js projects are in subdirectories of git repositories
- Support for mixed package manager monorepos (multiple projects with different package managers in same repository)
- Automatic git root detection when running from subdirectories
- Per-project guardian data storage to avoid conflicts between projects in same repository

### Changed
- Git hooks are now always installed in the repository root, regardless of where the command is run from
- Guardian data storage paths are now project-specific for subdirectory projects while maintaining backward compatibility
- Removed post-commit hook to simplify implementation (post-checkout, post-merge, and post-rewrite hooks remain)

### Fixed
- Fixed "Not a git repository" errors when running from subdirectories of git repositories
- Fixed guardian data conflicts when multiple Node.js projects exist in same monorepo
- Improved git operations to work correctly from any subdirectory within a git repository

## [1.0.1] - 2024-12-18

### Fixed
- Fixed release system publishing issues
- Improved package distribution and installation process

## [1.0.0] - 2024-12-17

### Added
- Initial release of lockfile-guardian
- Automatic detection of lockfile changes after git operations (checkout, merge, rewrite)
- Support for pnpm, yarn, and npm package managers
- Git hooks integration for automatic lockfile monitoring
- Post-install hooks to update dependency hashes after package installation
- Husky compatibility for projects using Husky for git hooks
- Configuration options for auto-install, silent mode, and node_modules checking
- CLI commands: install, uninstall, check, and status
- Warning system for out-of-date dependencies with installation instructions
- Preservation of existing git hooks when installing
- Guardian data storage in `.git/lockfile-guardian` for tracking dependency states

[Unreleased]: https://github.com/your-username/lockfile-guardian/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/your-username/lockfile-guardian/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/your-username/lockfile-guardian/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/your-username/lockfile-guardian/releases/tag/v1.0.0