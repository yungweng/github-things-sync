/**
 * start command - Start the background daemon
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { getDataDir, loadConfig } from "../../state/config.js";

export async function startCommand(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		console.error(
			chalk.red("❌ Not configured. Run `github-things-sync init` first."),
		);
		process.exit(1);
	}

	const pidFile = path.join(getDataDir(), "daemon.pid");
	const logFile = path.join(getDataDir(), "daemon.log");

	// Check if already running
	if (fs.existsSync(pidFile)) {
		const pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
		try {
			process.kill(pid, 0); // Check if process exists
			console.log(chalk.yellow(`⚠️  Daemon already running (PID: ${pid})`));
			console.log(
				chalk.dim(`   Use 'github-things-sync stop' to stop it first.`),
			);
			return;
		} catch {
			// Process doesn't exist, clean up stale PID file
			fs.unlinkSync(pidFile);
		}
	}

	// Find the daemon script path
	// In dev mode: src/daemon/index.ts exists, use tsx
	// In production: dist/daemon/index.js exists (separate tsup entry point), use node
	const scriptDir = path.dirname(new URL(import.meta.url).pathname);

	// Check for dev mode first (src/daemon/index.ts relative to src/cli/commands/)
	const tsScript = path.join(scriptDir, "../../daemon/index.ts");

	// For production, daemon/index.js is relative to cli/index.js in dist/
	const jsScript = path.join(scriptDir, "../daemon/index.js");

	// Use tsx for .ts files, node for compiled .js
	const useTs = fs.existsSync(tsScript);
	const daemonScript = useTs ? tsScript : jsScript;
	const runtime = useTs ? "tsx" : "node";

	// Start daemon as detached process
	const out = fs.openSync(logFile, "a");
	const err = fs.openSync(logFile, "a");

	const child = spawn(runtime, [daemonScript], {
		detached: true,
		stdio: ["ignore", out, err],
		env: { ...process.env },
	});

	if (child.pid) {
		fs.writeFileSync(pidFile, child.pid.toString());
		child.unref();

		console.log(
			chalk.green(`✅ Daemon started`) + chalk.dim(` (PID: ${child.pid})`),
		);
		console.log(chalk.dim(`   Polling every ${config.pollInterval} seconds`));
		console.log(chalk.dim(`   Logs: ${logFile}`));
	} else {
		console.error(chalk.red("❌ Failed to start daemon"));
		process.exit(1);
	}
}
