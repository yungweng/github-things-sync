# Configuration

## Config Command

```bash
# View current config
github-things-sync config

# Verify tokens work
github-things-sync config --verify
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--interval=SECONDS` | Poll interval (min: 60) | 300 |
| `--autostart=BOOL` | Start on login | true |
| `--project=NAME` | Things project name | GitHub |
| `--github-token=prompt` | Update GitHub token | - |
| `--things-token=prompt` | Update Things token | - |
| `--sync-types=TYPES` | Which item types to sync | all |

## Examples

```bash
# Poll every 2 minutes
github-things-sync config --interval=120

# Disable autostart
github-things-sync config --autostart=false

# Change Things project
github-things-sync config --project="Work"

# Update GitHub token (interactive)
github-things-sync config --github-token=prompt

# Only sync PR reviews and assigned issues
github-things-sync config --sync-types=pr-reviews,issues-assigned

# Sync all types (default)
github-things-sync config --sync-types=all
```

## Sync Types

Control which GitHub items are synced to Things:

| Type | Description |
|------|-------------|
| `pr-reviews` | PRs where you're requested as reviewer |
| `prs-created` | PRs you created |
| `issues-assigned` | Issues assigned to you |
| `issues-created` | Issues you created |

By default, all types are synced. Use comma-separated values to select specific types:

```bash
# Only PRs
github-things-sync config --sync-types=pr-reviews,prs-created

# Only issues
github-things-sync config --sync-types=issues-assigned,issues-created
```

**Note:** When you disable a sync type, existing tasks of that type will be marked as completed in Things.

## Setup Tokens

### GitHub Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate new token (classic)
3. Select `repo` scope
4. Copy token and use in `github-things-sync init`

### Things Auth Token

1. Open Things 3
2. Go to Settings → General → Things URLs
3. Click "Manage"
4. Copy the auth token

## File Locations

| File | Purpose |
|------|---------|
| `~/.github-things-sync/config.json` | Your settings |
| `~/.github-things-sync/state.json` | Sync state & mappings |
| `~/.github-things-sync/daemon.log` | Daemon logs |
| `~/.github-things-sync/daemon.pid` | Running daemon PID |
| `~/Library/LaunchAgents/com.github-things-sync.plist` | Autostart |
