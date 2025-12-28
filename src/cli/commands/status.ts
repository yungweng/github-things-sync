/**
 * status command - Show sync status and recent activity
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDataDir, loadConfig } from '../../state/config.js';
import { loadState } from '../../state/state.js';

export async function statusCommand(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('❌ Not configured. Run `github-things-sync init` first.');
    process.exit(1);
  }

  const pidFile = path.join(getDataDir(), 'daemon.pid');
  const state = loadState();

  // Daemon status
  console.log('\n📊 github-things-sync status\n');
  console.log('Daemon');
  console.log('──────');

  let isRunning = false;
  let pid: number | null = null;

  if (fs.existsSync(pidFile)) {
    pid = Number.parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0);
      isRunning = true;
    } catch {
      isRunning = false;
    }
  }

  if (isRunning) {
    console.log(`Status:  🟢 Running (PID: ${pid})`);
  } else {
    console.log('Status:  🔴 Stopped');
  }

  console.log(`Interval: ${config.pollInterval}s`);
  console.log(`Project:  ${config.thingsProject}`);

  // Sync status
  console.log('\nSync');
  console.log('────');

  if (state.lastSync) {
    const lastSync = new Date(state.lastSync);
    const ago = Math.round((Date.now() - lastSync.getTime()) / 1000);
    console.log(`Last sync: ${formatTimeAgo(ago)}`);
  } else {
    console.log('Last sync: Never');
  }

  if (state.lastError) {
    console.log(`Last error: ${state.lastError}`);
  }

  // Task mappings
  const mappings = Object.values(state.mappings);
  console.log(`\nTracked Tasks: ${mappings.length}`);

  if (mappings.length > 0) {
    console.log('───────────────');

    // Group by type
    const byType = {
      'pr-review': mappings.filter((m) => m.type === 'pr-review'),
      'pr-created': mappings.filter((m) => m.type === 'pr-created'),
      'issue-assigned': mappings.filter((m) => m.type === 'issue-assigned'),
      'issue-created': mappings.filter((m) => m.type === 'issue-created'),
    };

    if (byType['pr-review'].length > 0) {
      console.log(`\n🔍 PR Reviews (${byType['pr-review'].length})`);
      byType['pr-review'].slice(0, 5).forEach((m) => {
        console.log(`   • ${m.title}`);
      });
    }

    if (byType['pr-created'].length > 0) {
      console.log(`\n📝 Your PRs (${byType['pr-created'].length})`);
      byType['pr-created'].slice(0, 5).forEach((m) => {
        console.log(`   • ${m.title}`);
      });
    }

    if (byType['issue-assigned'].length > 0) {
      console.log(`\n📌 Assigned Issues (${byType['issue-assigned'].length})`);
      byType['issue-assigned'].slice(0, 5).forEach((m) => {
        console.log(`   • ${m.title}`);
      });
    }

    if (byType['issue-created'].length > 0) {
      console.log(`\n✏️  Your Issues (${byType['issue-created'].length})`);
      byType['issue-created'].slice(0, 5).forEach((m) => {
        console.log(`   • ${m.title}`);
      });
    }
  }

  console.log('');
}

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}
