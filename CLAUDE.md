# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

macOS CLI tool that syncs GitHub PRs and Issues to Things 3 task manager. Uses polling to fetch GitHub items via Octokit, creates/completes tasks in Things via AppleScript and URL Scheme.

## Commands

```bash
# Build (bundles src/ to dist/ via tsup)
pnpm build

# Dev mode (run TypeScript directly via tsx)
pnpm dev <command>
pnpm dev sync -v
pnpm dev config --verify
pnpm dev config --repos=prompt

# Type checking
pnpm typecheck

# Lint and format (Biome)
pnpm lint           # Check only
pnpm lint:fix       # Auto-fix lint issues
pnpm format         # Format files

# Install globally after build
pnpm link --global
```

## Architecture

```
src/
├── cli/           # Commander.js entry point + command handlers
│   └── commands/  # init, start, stop, status, sync, config
├── daemon/        # Background sync loop, LaunchAgent setup
├── github/        # Octokit client for GitHub API queries
├── things/        # AppleScript (create tasks) + URL Scheme (updates)
├── state/         # JSON persistence for config and task mappings
└── types/         # TypeScript type definitions
```

**Data flow**: Daemon polls GitHub → checks state for existing mappings → creates new tasks via AppleScript (returns task ID) → updates via URL Scheme → saves mappings to state.

**State files**: `~/.github-things-sync/` contains config.json, state.json, daemon.log, daemon.pid.

## Key Patterns

- **ES modules** with NodeNext resolution (`"type": "module"`)
- **Strict TypeScript** - all strict checks enabled
- **Biome** for linting/formatting (tabs, double quotes)
- **AppleScript for creation** (reliable task ID retrieval), **URL Scheme for updates** (setting Today, completion)
- **LaunchAgent** for macOS autostart (`~/Library/LaunchAgents/com.github-things-sync.plist`)
- **Config permissions**: restricted to 0o600 for security

## GitHub Queries

The daemon uses four search queries (configurable via sync-types):
- `is:pr is:open review-requested:@me` (pr-reviews)
- `is:pr is:open author:@me` (prs-created)
- `is:issue is:open assignee:@me` (issues-assigned)
- `is:issue is:open author:@me` (issues-created)

Results are filtered by repository scope (configurable via `--repos=prompt` or in init wizard).

## Publishing

```bash
# 1. Bump version
npm version patch  # or minor/major

# 2. Commit and push
git push origin main --tags

# 3. Create release (triggers CD pipeline)
gh release create vX.Y.Z --generate-notes
```

Publishing is automated via GitHub Actions with OIDC trusted publishing (no npm tokens).
