/**
 * start command - Start the background daemon
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getDataDir, loadConfig } from '../../state/config.js';

export async function startCommand(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('❌ Not configured. Run `github-things-sync init` first.');
    process.exit(1);
  }

  const pidFile = path.join(getDataDir(), 'daemon.pid');
  const logFile = path.join(getDataDir(), 'daemon.log');

  // Check if already running
  if (fs.existsSync(pidFile)) {
    const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0); // Check if process exists
      console.log(`⚠️  Daemon already running (PID: ${pid})`);
      console.log(`   Use 'github-things-sync stop' to stop it first.`);
      return;
    } catch {
      // Process doesn't exist, clean up stale PID file
      fs.unlinkSync(pidFile);
    }
  }

  // Find the daemon script path
  const daemonScript = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../daemon/index.js'
  );

  // Start daemon as detached process
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn('node', [daemonScript], {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env },
  });

  if (child.pid) {
    fs.writeFileSync(pidFile, child.pid.toString());
    child.unref();

    console.log(`✅ Daemon started (PID: ${child.pid})`);
    console.log(`   Polling every ${config.pollInterval} seconds`);
    console.log(`   Logs: ${logFile}`);
  } else {
    console.error('❌ Failed to start daemon');
    process.exit(1);
  }
}
