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

program.parse();
