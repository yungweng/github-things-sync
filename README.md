# github-things-sync

<p align="center">
  <a href="https://www.npmjs.com/package/github-things-sync"><img src="https://img.shields.io/npm/v/github-things-sync.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/github-things-sync"><img src="https://img.shields.io/npm/dm/github-things-sync.svg" alt="downloads"></a>
  <a href="https://github.com/yungweng/github-things-sync/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/github-things-sync.svg" alt="license"></a>
  <img src="https://img.shields.io/node/v/github-things-sync.svg" alt="node version">
</p>

**Automatically sync your GitHub PRs and Issues to Things 3 on macOS.**

Stop manually creating todos for your GitHub work. github-things-sync watches your assigned issues, PR reviews, and created items—automatically creating and completing tasks in Things 3.

<p align="center">
  <img src="assets/demo.gif" alt="Demo" width="700">
</p>

## Quick Start

```bash
npm install -g github-things-sync
github-things-sync init
```

*Follow the prompts, then:*

```bash
github-things-sync start
```

## Features

- 🔄 **Auto-sync** — PRs and issues appear in Things automatically
- ✅ **Completion tracking** — Close an issue, task completes in Things
- 📋 **Smart filtering** — Choose what to sync (reviews, created, assigned)
- 🎯 **Repository scope** — Select specific repos or orgs to sync
- 🚀 **Background daemon** — Runs silently, syncs every 5 minutes
- 🍎 **macOS native** — Uses LaunchAgent for autostart

## What Gets Synced

| GitHub | → | Things |
|--------|---|--------|
| PR review requested | → | Todo in "GitHub" project |
| Issue assigned to you | → | Todo with issue link |
| PR you created | → | Todo with PR link |
| Issue you created | → | Todo with issue link |
| Closed/merged item | → | Task marked complete |

## Prerequisites

- macOS (Things 3 is macOS/iOS only)
- [Things 3](https://culturedcode.com/things/) installed
- Node.js 20+
- [GitHub Personal Access Token](https://github.com/settings/tokens) (classic, `repo` scope)

## Installation

### Via npm (recommended)

```bash
npm install -g github-things-sync
github-things-sync init
```

### Via npx (no install)

```bash
npx github-things-sync init
```

<details>
<summary>Manual installation from source</summary>

```bash
git clone https://github.com/yungweng/github-things-sync.git
cd github-things-sync
pnpm install && pnpm build
pnpm link --global
```

</details>

## Commands

| Command | Description |
|---------|-------------|
| `init` | Interactive setup wizard |
| `start` | Start background sync daemon |
| `stop` | Stop the daemon |
| `status` | Show daemon status and task mappings |
| `sync` | Run a single sync (no daemon) |
| `config` | View or update settings |
| `config --verify` | Verify your tokens work |

## How It Works

```
┌─────────────┐     Poll      ┌──────────────┐    AppleScript    ┌──────────┐
│   GitHub    │ ◄──────────── │    Daemon    │ ─────────────────► │ Things 3 │
│   API       │               │ (background) │    URL Scheme      │   App    │
└─────────────┘               └──────────────┘                    └──────────┘
                                     │
                                     ▼
                              ~/.github-things-sync/
                              ├── config.json
                              ├── state.json
                              └── daemon.log
```

The daemon polls GitHub every 5 minutes (configurable) for:
- PRs where you're requested as reviewer
- PRs you created
- Issues assigned to you
- Issues you created

When items are found, it creates tasks in Things 3 via AppleScript. When items close/merge on GitHub, the corresponding tasks are completed via URL Scheme.

## Configuration

After running `init`, your config is stored at `~/.github-things-sync/config.json`.

Update settings with:

```bash
github-things-sync config --interval=600      # Poll every 10 minutes
github-things-sync config --project="Work"    # Use different Things project
github-things-sync config --sync-types=pr-reviews,issues-assigned
github-things-sync config --repos=prompt      # Select specific repos to sync
github-things-sync config --repos=all         # Reset to sync all repos
```

## Development

```bash
git clone https://github.com/yungweng/github-things-sync.git
cd github-things-sync
pnpm install
pnpm dev sync -v  # Run sync in dev mode
```

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/yungweng/github-things-sync/issues).

Pull requests are welcome!

## License

MIT © [yungweng](https://github.com/yungweng)
