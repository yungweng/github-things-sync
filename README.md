# github-things-sync

Sync GitHub PRs and Issues to Things 3 on macOS. Automatically creates tasks when you're assigned to issues or requested for PR reviews, and closes them when the GitHub item is resolved.

## Features

- **PR Review Requests** → Task "Review: [PR Title]"
- **PRs you created** → Task "PR: [PR Title]" with status tracking
- **Issues assigned to you** → Task "Issue: [Title]"
- **Issues you created** → Task "My Issue: [Title]"
- **Auto-close** → Tasks complete when PRs are merged or Issues closed
- **Runs as daemon** → Polls every 5 minutes, starts automatically on login

## Installation

```bash
# Install globally
npm install -g github-things-sync

# Or run directly with npx
npx github-things-sync init
```

## Quick Start

```bash
# 1. Setup (creates config, installs LaunchAgent)
github-things-sync init

# 2. Start the daemon
github-things-sync start

# That's it! Tasks will appear in Things under "GitHub" project
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `github-things-sync init` | Interactive setup wizard |
| `github-things-sync start` | Start the background daemon |
| `github-things-sync stop` | Stop the daemon |
| `github-things-sync status` | Show sync status and recent activity |
| `github-things-sync sync` | Run a single sync (no daemon) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Mac                                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    github-things-sync                     │  │
│  │                                                           │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐  │  │
│  │  │   CLI       │    │   Daemon    │    │   State      │  │  │
│  │  │             │    │             │    │   (JSON)     │  │  │
│  │  │ • init      │───▶│ • Poll Loop │◀──▶│              │  │  │
│  │  │ • start     │    │ • Every 5m  │    │ • Mappings   │  │  │
│  │  │ • stop      │    │             │    │ • Config     │  │  │
│  │  │ • status    │    └──────┬──────┘    └──────────────┘  │  │
│  │  │ • sync      │           │                              │  │
│  │  └─────────────┘           │                              │  │
│  │                            ▼                              │  │
│  │                 ┌─────────────────────┐                   │  │
│  │                 │   Things 3          │                   │  │
│  │                 │   (URL Scheme)      │                   │  │
│  │                 └─────────────────────┘                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            │ GitHub REST API                    │
└────────────────────────────┼────────────────────────────────────┘
                             ▼
                   ┌─────────────────────┐
                   │      GitHub         │
                   └─────────────────────┘
```

### Components

#### CLI (`src/cli/`)
Entry point for all user commands. Uses [Commander.js](https://github.com/tj/commander.js) for argument parsing.

#### Daemon (`src/daemon/`)
Background process that:
1. Polls GitHub API every 5 minutes
2. Compares with local state
3. Creates/updates/completes Things tasks
4. Persists state to JSON

#### GitHub Client (`src/github/`)
Wrapper around GitHub REST API using [Octokit](https://github.com/octokit/octokit.js). Fetches:
- `GET /search/issues?q=review-requested:@me` (PR review requests)
- `GET /search/issues?q=author:@me+is:pr` (PRs you created)
- `GET /search/issues?q=assignee:@me+is:issue` (Assigned issues)
- `GET /search/issues?q=author:@me+is:issue` (Issues you created)

#### Things Client (`src/things/`)
Creates and updates tasks via Things URL Scheme:
- `things:///add?title=...&when=today&list=GitHub`
- `things:///update?id=...&completed=true`

Requires Things URL Scheme to be enabled: Things → Settings → General → Enable Things URLs

#### State (`src/state/`)
JSON file at `~/.github-things-sync/state.json`:
```json
{
  "mappings": {
    "github:pr:123456": {
      "thingsId": "ABC-DEF-123",
      "type": "pr-review",
      "title": "Review: Add feature X",
      "url": "https://github.com/org/repo/pull/42",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  },
  "lastSync": "2024-01-15T12:00:00Z"
}
```

#### Config (`~/.github-things-sync/config.json`)
```json
{
  "githubToken": "ghp_...",
  "thingsProject": "GitHub",
  "thingsAuthToken": "...",
  "pollInterval": 300,
  "autoStart": true
}
```

### Data Flow

#### Creating a Task
```
1. GitHub API returns new PR review request
2. Check state.mappings → not found
3. Call Things URL: things:///add?title=Review: Fix bug&when=today&list=GitHub
4. Things returns x-things-id
5. Save to state.mappings: { "github:pr:123": { thingsId: "...", ... } }
```

#### Completing a Task
```
1. GitHub API returns PR is merged
2. Check state.mappings → found thingsId
3. Call Things URL: things:///update?id={thingsId}&auth-token=...&completed=true
4. Remove from state.mappings
```

## Requirements

- macOS (Things 3 is macOS/iOS only)
- Things 3 with URL Scheme enabled
- Node.js 18+
- GitHub Personal Access Token with `repo` scope

## Configuration

### GitHub Token

Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope.

### Things Auth Token

Required for updating/completing tasks. Find it in:
Things → Settings → General → Things URLs → Manage

## File Locations

| File | Purpose |
|------|---------|
| `~/.github-things-sync/config.json` | User configuration |
| `~/.github-things-sync/state.json` | Sync state and mappings |
| `~/.github-things-sync/daemon.log` | Daemon logs |
| `~/Library/LaunchAgents/com.github-things-sync.plist` | Autostart config |

## Development

```bash
# Clone
git clone https://github.com/yonnock/github-things-sync.git
cd github-things-sync

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm run dev -- init
npm run dev -- sync
```

## License

MIT
