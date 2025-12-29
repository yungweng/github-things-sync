/**
 * stop command - Stop the daemon
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getDataDir } from '../../state/config.js';

export async function stopCommand(): Promise<void> {
  const pidFile = path.join(getDataDir(), 'daemon.pid');

  if (!fs.existsSync(pidFile)) {
    console.log(chalk.cyan('ℹ️  Daemon is not running'));
    return;
  }

  const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);

  try {
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(pidFile);
    console.log(chalk.green(`✅ Daemon stopped`) + chalk.dim(` (PID: ${pid})`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      // Process doesn't exist, clean up
      fs.unlinkSync(pidFile);
      console.log(chalk.cyan('ℹ️  Daemon was not running (cleaned up stale PID file)'));
    } else {
      console.error(chalk.red(`❌ Failed to stop daemon: ${error}`));
      process.exit(1);
    }
  }
}
