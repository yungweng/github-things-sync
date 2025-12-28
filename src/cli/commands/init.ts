/**
 * init command - Interactive setup wizard
 */

import * as readline from 'readline';
import { saveConfig, getConfigPath, getDataDir } from '../../state/config.js';
import { installLaunchAgent } from '../../daemon/launchagent.js';
import type { Config, SyncType } from '../../types/index.js';
import { ALL_SYNC_TYPES } from '../../types/index.js';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function initCommand(): Promise<void> {
  console.log('\n🔧 github-things-sync setup\n');
  console.log('This wizard will configure the sync between GitHub and Things 3.\n');

  // Step 1: GitHub Token
  console.log('Step 1: GitHub Personal Access Token');
  console.log('─────────────────────────────────────');
  console.log('Create a token at: https://github.com/settings/tokens');
  console.log('Required scope: repo\n');

  const githubToken = await prompt('GitHub Token: ');
  if (!githubToken) {
    console.error('❌ GitHub token is required');
    process.exit(1);
  }

  // Step 2: Things Auth Token
  console.log('\nStep 2: Things Auth Token');
  console.log('─────────────────────────');
  console.log('Find it in: Things → Settings → General → Things URLs → Manage\n');

  const thingsAuthToken = await prompt('Things Auth Token: ');
  if (!thingsAuthToken) {
    console.error('❌ Things auth token is required for auto-completing tasks');
    process.exit(1);
  }

  // Step 3: Things Project
  console.log('\nStep 3: Things Project');
  console.log('──────────────────────');
  console.log('Tasks will be created in this project (must exist in Things)\n');

  const thingsProject = await prompt('Project name [GitHub]: ') || 'GitHub';

  // Step 4: Poll Interval
  console.log('\nStep 4: Poll Interval');
  console.log('─────────────────────');
  console.log('How often to check GitHub for updates (in seconds)\n');

  const pollIntervalStr = await prompt('Interval [300]: ') || '300';
  const pollInterval = Number.parseInt(pollIntervalStr, 10);

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

  // Step 6: Auto-start
  console.log('\nStep 6: Auto-start');
  console.log('──────────────────');
  console.log('Start automatically when you log in to your Mac?\n');

  const autoStartStr = await prompt('Enable auto-start? [Y/n]: ');
  const autoStart = autoStartStr.toLowerCase() !== 'n';

  // Save config
  const config: Config = {
    githubToken,
    thingsProject,
    thingsAuthToken,
    pollInterval,
    autoStart,
    syncTypes,
  };

  saveConfig(config);

  console.log(`\n✅ Configuration saved to ${getConfigPath()}`);

  // Install LaunchAgent if requested
  if (autoStart) {
    installLaunchAgent();
    console.log('✅ LaunchAgent installed (auto-start enabled)');
  }

  console.log('\n🎉 Setup complete! Run `github-things-sync start` to begin syncing.\n');
  console.log(`📁 Data directory: ${getDataDir()}`);
  console.log('📋 Make sure the project "' + thingsProject + '" exists in Things 3\n');
}
