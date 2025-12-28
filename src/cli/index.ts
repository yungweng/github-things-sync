#!/usr/bin/env node
/**
 * CLI entry point for github-things-sync
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { syncCommand } from './commands/sync.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('github-things-sync')
  .description('Sync GitHub PRs and Issues to Things 3 on macOS')
  .version('0.1.0');

program
  .command('init')
  .description('Interactive setup wizard')
  .action(initCommand);

program
  .command('start')
  .description('Start the background daemon')
  .action(startCommand);

program
  .command('stop')
  .description('Stop the daemon')
  .action(stopCommand);

program
  .command('status')
  .description('Show sync status and recent activity')
  .action(statusCommand);

program
  .command('sync')
  .description('Run a single sync (no daemon)')
  .option('-v, --verbose', 'Show detailed output')
  .action(syncCommand);

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

program.parse();
