/**
 * Core sync logic
 */

import { GitHubClient } from '../github/client.js';
import { ThingsClient } from '../things/client.js';
import {
  loadState,
  saveState,
  hasMapping,
  addMapping,
  removeMapping,
  getMapping,
  updateLastSync,
  setLastError,
} from '../state/state.js';
import type { Config, GitHubItem, TaskMapping } from '../types/index.js';

export interface SyncResult {
  created: number;
  completed: number;
  unchanged: number;
  errors: string[];
}

export async function runSync(
  config: Config,
  verbose: boolean = false
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    completed: 0,
    unchanged: 0,
    errors: [],
  };

  const github = new GitHubClient(config.githubToken);
  const things = new ThingsClient(config.thingsProject, config.thingsAuthToken);

  try {
    // Step 1: Fetch all open items from GitHub
    if (verbose) console.log('Fetching items from GitHub...');
    const githubItems = await github.fetchAllItems();
    if (verbose) console.log(`Found ${githubItems.length} open items`);

    // Step 2: Create tasks for new items
    for (const item of githubItems) {
      const githubId = makeGithubId(item);

      if (hasMapping(githubId)) {
        result.unchanged++;
        if (verbose) console.log(`  ⏭️  Already tracked: ${item.title}`);
        continue;
      }

      try {
        if (verbose) console.log(`  ➕ Creating task: ${item.title}`);
        const thingsId = await things.createTask(item);

        const mapping: TaskMapping = {
          githubId,
          thingsId,
          type: item.type,
          title: item.title,
          url: item.url,
          createdAt: new Date().toISOString(),
        };

        addMapping(mapping);
        result.created++;
      } catch (error) {
        const msg = `Failed to create task for ${item.title}: ${error}`;
        result.errors.push(msg);
        if (verbose) console.log(`  ❌ ${msg}`);
      }
    }

    // Step 3: Complete tasks for closed items
    const state = loadState();
    const openGithubIds = new Set(githubItems.map(makeGithubId));

    for (const [githubId, mapping] of Object.entries(state.mappings)) {
      // Skip if item is still open
      if (openGithubIds.has(githubId)) {
        continue;
      }

      // Item is no longer in open list - it's been closed/merged
      try {
        if (verbose) console.log(`  ✅ Completing task: ${mapping.title}`);
        await things.completeTask(mapping.thingsId);
        removeMapping(githubId);
        result.completed++;
      } catch (error) {
        const msg = `Failed to complete task ${mapping.title}: ${error}`;
        result.errors.push(msg);
        if (verbose) console.log(`  ❌ ${msg}`);
      }
    }

    updateLastSync();
  } catch (error) {
    const msg = `Sync failed: ${error}`;
    result.errors.push(msg);
    setLastError(msg);
    throw error;
  }

  return result;
}

function makeGithubId(item: GitHubItem): string {
  const prefix = item.type.startsWith('pr-') ? 'pr' : 'issue';
  return `${prefix}:${item.id}`;
}
