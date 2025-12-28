/**
 * init command - Interactive setup wizard
 */

import * as readline from 'readline';
import { saveConfig, getConfigPath, getDataDir } from '../../state/config.js';
import { installLaunchAgent } from '../../daemon/launchagent.js';
import type { Config } from '../../types/index.js';

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

  // Step 5: Auto-start
  console.log('\nStep 5: Auto-start');
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
