/**
 * config command - View and update settings
 */

import * as readline from 'readline';
import { Octokit } from '@octokit/rest';
import { loadConfig, saveConfig } from '../../state/config.js';
import { installLaunchAgent, uninstallLaunchAgent } from '../../daemon/launchagent.js';
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

interface ConfigOptions {
  interval?: string;
  autostart?: string;
  project?: string;
  githubToken?: string;
  thingsToken?: string;
  verify?: boolean;
  show?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('❌ Not configured. Run `github-things-sync init` first.');
    process.exit(1);
  }

  // Show current config
  if (options.show || Object.keys(options).length === 0) {
    await showConfig(config);
    return;
  }

  // Verify tokens
  if (options.verify) {
    await verifyTokens(config);
    return;
  }

  // Update settings
  let changed = false;

  if (options.interval !== undefined) {
    const interval = Number.parseInt(options.interval, 10);
    if (Number.isNaN(interval) || interval < 60) {
      console.error('❌ Interval must be at least 60 seconds');
      process.exit(1);
    }
    config.pollInterval = interval;
    console.log(`✅ Poll interval set to ${interval}s`);
    changed = true;
  }

  if (options.autostart !== undefined) {
    const enabled = options.autostart === 'true' || options.autostart === 'on';
    const disabled = options.autostart === 'false' || options.autostart === 'off';

    if (!enabled && !disabled) {
      console.error('❌ Use --autostart=true or --autostart=false');
      process.exit(1);
    }

    config.autoStart = enabled;

    if (enabled) {
      installLaunchAgent();
      console.log('✅ Autostart enabled (LaunchAgent installed)');
    } else {
      uninstallLaunchAgent();
      console.log('✅ Autostart disabled (LaunchAgent removed)');
    }
    changed = true;
  }

  if (options.project !== undefined) {
    config.thingsProject = options.project;
    console.log(`✅ Things project set to "${options.project}"`);
    changed = true;
  }

  if (options.githubToken !== undefined) {
    const token = options.githubToken === 'prompt'
      ? await prompt('New GitHub Token: ')
      : options.githubToken;

    config.githubToken = token;
    console.log('✅ GitHub token updated');
    changed = true;
  }

  if (options.thingsToken !== undefined) {
    const token = options.thingsToken === 'prompt'
      ? await prompt('New Things Auth Token: ')
      : options.thingsToken;

    config.thingsAuthToken = token;
    console.log('✅ Things auth token updated');
    changed = true;
  }

  if (changed) {
    saveConfig(config);
    console.log('\n💾 Config saved. Restart daemon for changes to take effect.');
  }
}

async function showConfig(config: Config): Promise<void> {
  console.log('\n⚙️  github-things-sync config\n');
  console.log('Settings');
  console.log('────────');
  console.log(`Project:      ${config.thingsProject}`);
  console.log(`Poll interval: ${config.pollInterval}s (${config.pollInterval / 60} min)`);
  console.log(`Autostart:    ${config.autoStart ? '✅ enabled' : '❌ disabled'}`);
  console.log('');
  console.log('Tokens');
  console.log('──────');
  console.log(`GitHub:       ${maskToken(config.githubToken)}`);
  console.log(`Things:       ${maskToken(config.thingsAuthToken)}`);
  console.log('');
  console.log('Usage');
  console.log('─────');
  console.log('  --interval=SECONDS    Set poll interval (min: 60)');
  console.log('  --autostart=true|false Enable/disable autostart');
  console.log('  --project=NAME        Set Things project name');
  console.log('  --github-token=prompt Update GitHub token');
  console.log('  --things-token=prompt Update Things token');
  console.log('  --verify              Verify tokens work');
  console.log('');
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '...' + token.slice(-4);
}

async function verifyTokens(config: Config): Promise<void> {
  console.log('\n🔍 Verifying tokens...\n');

  // Verify GitHub token
  console.log('GitHub Token');
  console.log('────────────');
  try {
    const octokit = new Octokit({ auth: config.githubToken });
    const { data } = await octokit.users.getAuthenticated();
    console.log(`✅ Valid - logged in as @${data.login}`);

    // Check scopes
    const response = await octokit.request('GET /user');
    const scopes = response.headers['x-oauth-scopes'] || '';
    console.log(`   Scopes: ${scopes || '(none visible)'}`);
  } catch (error) {
    console.log(`❌ Invalid - ${error}`);
  }

  // Verify Things token (we can only check if Things is running)
  console.log('\nThings Auth Token');
  console.log('─────────────────');
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync('osascript -e \'tell application "Things3" to return name\'');
    console.log('✅ Things 3 is running');
    console.log(`   Token: ${maskToken(config.thingsAuthToken)}`);
    console.log('   (Token validity is checked when updating tasks)');
  } catch {
    console.log('⚠️  Things 3 is not running');
  }

  console.log('');
}
