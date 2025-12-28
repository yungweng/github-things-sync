# Sync Types Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to configure which GitHub item types (PR reviews, own PRs, assigned issues, own issues) get synced to Things.

**Architecture:** Add `syncTypes` array to Config interface, update init wizard with interactive selection, add `--sync-types` flag to config command, modify GitHubClient to filter fetches based on config.

**Tech Stack:** TypeScript, Commander.js CLI

---

## Task 1: Add syncTypes to Config type

**Files:**
- Modify: `src/types/index.ts:44-50`

**Step 1: Add SyncType type alias and syncTypes to Config**

Add after line 10 (after GitHubItemType definition):

```typescript
// Sync type identifiers for config
export type SyncType = 'pr-reviews' | 'prs-created' | 'issues-assigned' | 'issues-created';

// All available sync types (for validation)
export const ALL_SYNC_TYPES: SyncType[] = [
  'pr-reviews',
  'prs-created',
  'issues-assigned',
  'issues-created',
];
```

Then modify Config interface (around line 44) to add syncTypes:

```typescript
// User configuration
export interface Config {
  githubToken: string;
  thingsProject: string;      // Default: "GitHub"
  thingsAuthToken: string;    // Required for updating tasks
  pollInterval: number;       // Seconds, default: 300 (5 min)
  autoStart: boolean;         // Install LaunchAgent
  syncTypes: SyncType[];      // Which item types to sync (default: all)
}
```

**Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Errors about missing syncTypes in config objects (expected, we'll fix in next tasks)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add syncTypes to Config interface"
```

---

## Task 2: Update init command with sync types selection

**Files:**
- Modify: `src/cli/commands/init.ts`

**Step 1: Add sync types selection step**

After Step 4 (Poll Interval) around line 64, add new Step 5 for sync types:

```typescript
  // Step 5: Sync Types
  console.log('\nStep 5: Sync Types');
  console.log('──────────────────');
  console.log('Which GitHub items should be synced to Things?\n');
  console.log('  1. pr-reviews      - PRs where you are requested as reviewer');
  console.log('  2. prs-created     - PRs you created');
  console.log('  3. issues-assigned - Issues assigned to you');
  console.log('  4. issues-created  - Issues you created\n');

  const syncTypesInput = await prompt('Sync types (comma-separated, or "all") [all]: ') || 'all';

  let syncTypes: SyncType[];
  if (syncTypesInput.toLowerCase() === 'all') {
    syncTypes = [...ALL_SYNC_TYPES];
  } else {
    const requested = syncTypesInput.split(',').map(s => s.trim()) as SyncType[];
    const valid = requested.filter(t => ALL_SYNC_TYPES.includes(t));
    if (valid.length === 0) {
      console.error('❌ No valid sync types provided. Use: pr-reviews, prs-created, issues-assigned, issues-created');
      process.exit(1);
    }
    syncTypes = valid;
  }
```

**Step 2: Update imports**

Add to imports at top:

```typescript
import type { Config, SyncType } from '../../types/index.js';
import { ALL_SYNC_TYPES } from '../../types/index.js';
```

Remove the old Config-only import.

**Step 3: Rename old Step 5 to Step 6**

Change "Step 5: Auto-start" to "Step 6: Auto-start" (around line 69).

**Step 4: Add syncTypes to config object**

Update the config object (around line 75):

```typescript
  const config: Config = {
    githubToken,
    thingsProject,
    thingsAuthToken,
    pollInterval,
    autoStart,
    syncTypes,
  };
```

**Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Still errors in other files (config.ts, etc.)

**Step 6: Commit**

```bash
git add src/cli/commands/init.ts
git commit -m "feat: add sync types selection to init wizard"
```

---

## Task 3: Update config command with --sync-types flag

**Files:**
- Modify: `src/cli/commands/config.ts`

**Step 1: Add syncTypes to ConfigOptions interface**

Update ConfigOptions (around line 25):

```typescript
interface ConfigOptions {
  interval?: string;
  autostart?: string;
  project?: string;
  githubToken?: string;
  thingsToken?: string;
  syncTypes?: string;
  verify?: boolean;
  show?: boolean;
}
```

**Step 2: Add imports**

Update imports to include SyncType and ALL_SYNC_TYPES:

```typescript
import type { Config, SyncType } from '../../types/index.js';
import { ALL_SYNC_TYPES } from '../../types/index.js';
```

**Step 3: Add syncTypes handling in configCommand**

After the thingsToken handling (around line 113), add:

```typescript
  if (options.syncTypes !== undefined) {
    let syncTypes: SyncType[];
    if (options.syncTypes.toLowerCase() === 'all') {
      syncTypes = [...ALL_SYNC_TYPES];
    } else {
      const requested = options.syncTypes.split(',').map(s => s.trim()) as SyncType[];
      const valid = requested.filter(t => ALL_SYNC_TYPES.includes(t));
      if (valid.length === 0) {
        console.error('❌ No valid sync types. Use: pr-reviews, prs-created, issues-assigned, issues-created');
        process.exit(1);
      }
      syncTypes = valid;
    }
    config.syncTypes = syncTypes;
    console.log(`✅ Sync types set to: ${syncTypes.join(', ')}`);
    changed = true;
  }
```

**Step 4: Update showConfig to display syncTypes**

In showConfig function (around line 127), add after autoStart line:

```typescript
  console.log(`Sync types:   ${config.syncTypes?.join(', ') || 'all (default)'}`);
```

**Step 5: Update usage help in showConfig**

Add to the Usage section (around line 142):

```typescript
  console.log('  --sync-types=TYPES    Set sync types (comma-separated or "all")');
```

**Step 6: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Still errors in GitHubClient

**Step 7: Commit**

```bash
git add src/cli/commands/config.ts
git commit -m "feat: add --sync-types flag to config command"
```

---

## Task 4: Update CLI to register --sync-types option

**Files:**
- Modify: `src/cli/index.ts`

**Step 1: Add --sync-types option to config command**

Update the config command options (around line 56):

```typescript
program
  .command('config')
  .description('View and update settings')
  .option('--show', 'Show current config (default)')
  .option('--interval <seconds>', 'Set poll interval (min: 60)')
  .option('--autostart <bool>', 'Enable/disable autostart (true/false)')
  .option('--project <name>', 'Set Things project name')
  .option('--github-token <token>', 'Update GitHub token (use "prompt" for interactive)')
  .option('--things-token <token>', 'Update Things token (use "prompt" for interactive)')
  .option('--sync-types <types>', 'Set sync types (comma-separated or "all")')
  .option('--verify', 'Verify tokens work')
  .action(configCommand);
```

**Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Still errors in GitHubClient

**Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: register --sync-types CLI option"
```

---

## Task 5: Update GitHubClient to respect syncTypes

**Files:**
- Modify: `src/github/client.ts`

**Step 1: Update imports**

Add SyncType import:

```typescript
import type { GitHubItem, GitHubItemType, SyncType } from '../types/index.js';
```

**Step 2: Add syncTypes parameter to constructor**

Update the class to accept and store syncTypes:

```typescript
export class GitHubClient {
  private octokit: Octokit;
  private username: string | null = null;
  private syncTypes: SyncType[];

  constructor(token: string, syncTypes?: SyncType[]) {
    this.octokit = new Octokit({ auth: token });
    this.syncTypes = syncTypes || ['pr-reviews', 'prs-created', 'issues-assigned', 'issues-created'];
  }
```

**Step 3: Update fetchAllItems to filter based on syncTypes**

Replace the fetchAllItems method:

```typescript
  /**
   * Fetch all items we care about from GitHub
   */
  async fetchAllItems(): Promise<GitHubItem[]> {
    const username = await this.getUsername();
    const items: GitHubItem[] = [];

    // Build list of fetch promises based on enabled sync types
    const fetches: Promise<GitHubItem[]>[] = [];

    if (this.syncTypes.includes('pr-reviews')) {
      fetches.push(this.fetchPRReviewRequests(username));
    }
    if (this.syncTypes.includes('prs-created')) {
      fetches.push(this.fetchPRsCreated(username));
    }
    if (this.syncTypes.includes('issues-assigned')) {
      fetches.push(this.fetchIssuesAssigned(username));
    }
    if (this.syncTypes.includes('issues-created')) {
      fetches.push(this.fetchIssuesCreated(username));
    }

    // Fetch in parallel
    const results = await Promise.all(fetches);
    for (const result of results) {
      items.push(...result);
    }

    return items;
  }
```

**Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Errors where GitHubClient is instantiated without syncTypes

**Step 5: Commit**

```bash
git add src/github/client.ts
git commit -m "feat: filter GitHub fetches based on syncTypes config"
```

---

## Task 6: Update sync command to pass syncTypes to GitHubClient

**Files:**
- Modify: `src/cli/commands/sync.ts`

**Step 1: Read the file first**

Need to check how GitHubClient is instantiated.

**Step 2: Update GitHubClient instantiation**

Pass config.syncTypes to the constructor:

```typescript
const github = new GitHubClient(config.githubToken, config.syncTypes);
```

**Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: May have errors in daemon/sync.ts

**Step 4: Commit**

```bash
git add src/cli/commands/sync.ts
git commit -m "fix: pass syncTypes to GitHubClient in sync command"
```

---

## Task 7: Update daemon sync to pass syncTypes to GitHubClient

**Files:**
- Modify: `src/daemon/sync.ts`

**Step 1: Read the file first**

Check how GitHubClient is used in daemon.

**Step 2: Update GitHubClient instantiation**

Pass config.syncTypes to the constructor.

**Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (all files updated)

**Step 4: Commit**

```bash
git add src/daemon/sync.ts
git commit -m "fix: pass syncTypes to GitHubClient in daemon"
```

---

## Task 8: Handle migration for existing configs

**Files:**
- Modify: `src/state/config.ts`

**Step 1: Add migration logic to loadConfig**

Update loadConfig to add default syncTypes if missing:

```typescript
import { ALL_SYNC_TYPES } from '../types/index.js';

export function loadConfig(): Config | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as Config;

    // Migration: add syncTypes if missing (for existing configs)
    if (!config.syncTypes) {
      config.syncTypes = [...ALL_SYNC_TYPES];
    }

    return config;
  } catch {
    return null;
  }
}
```

**Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Verify build passes**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/state/config.ts
git commit -m "fix: migrate existing configs to include syncTypes"
```

---

## Task 9: Manual testing

**Step 1: Test init command**

Run: `npm run dev -- init`
Expected: See new Step 5 asking for sync types

**Step 2: Test config show**

Run: `npm run dev -- config`
Expected: See syncTypes in output

**Step 3: Test config --sync-types**

Run: `npm run dev -- config --sync-types=pr-reviews,issues-assigned`
Expected: "Sync types set to: pr-reviews, issues-assigned"

**Step 4: Test sync with filtered types**

Run: `npm run dev -- sync -v`
Expected: Only fetches configured types

---

## Summary

After completing all tasks:
- Users can select sync types during `init`
- Users can change sync types via `config --sync-types=...`
- Existing configs auto-migrate to include all types
- GitHubClient only fetches enabled types
