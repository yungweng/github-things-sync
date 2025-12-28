# Troubleshooting

## Tasks not appearing in Things?

1. **Check Things URL Scheme is enabled:**
   - Things → Settings → General → Enable Things URLs

2. **Verify your tokens:**
   ```bash
   github-things-sync config --verify
   ```

3. **Check the daemon is running:**
   ```bash
   github-things-sync status
   ```

4. **Try a manual sync:**
   ```bash
   github-things-sync sync -v
   ```

## Tasks not appearing in Today?

The `when=today` is set via URL Scheme after task creation. If tasks appear in the project but not in Today:

1. Check Things URL Scheme is enabled
2. Check your Things Auth Token is correct

## Daemon not starting?

1. **Check logs:**
   ```bash
   cat ~/.github-things-sync/daemon.log
   ```

2. **Check if already running:**
   ```bash
   github-things-sync status
   ```

3. **Stop and restart:**
   ```bash
   github-things-sync stop
   github-things-sync start
   ```

## Tasks not auto-completing?

1. **Ensure Things Auth Token is set:**
   - Found in: Things → Settings → General → Things URLs → Manage

2. **Verify the token:**
   ```bash
   github-things-sync config --verify
   ```

## GitHub Token Issues

**"Bad credentials" error:**
- Token may have expired
- Update it: `github-things-sync config --github-token=prompt`

**Missing PRs/Issues:**
- Token needs `repo` scope for private repos
- Create new token at [github.com/settings/tokens](https://github.com/settings/tokens)

## Reset Everything

```bash
# Stop daemon
github-things-sync stop

# Remove all data
rm -rf ~/.github-things-sync

# Remove autostart
rm ~/Library/LaunchAgents/com.github-things-sync.plist

# Start fresh
github-things-sync init
```

## Still stuck?

Check the logs for details:

```bash
# Daemon logs
cat ~/.github-things-sync/daemon.log

# Current state
cat ~/.github-things-sync/state.json | jq .

# Current config (tokens hidden)
github-things-sync config
```
