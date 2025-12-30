/**
 * status command - Show sync status and recent activity
 */

import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { getDataDir, loadConfig } from "../../state/config.js";
import { loadState } from "../../state/state.js";

export async function statusCommand(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		console.error(
			chalk.red("❌ Not configured. Run `github-things-sync init` first."),
		);
		process.exit(1);
	}

	const pidFile = path.join(getDataDir(), "daemon.pid");
	const state = loadState();

	// Daemon status
	console.log(chalk.bold("\n📊 github-things-sync status\n"));
	console.log(chalk.bold("Daemon"));
	console.log(chalk.dim("──────"));

	let isRunning = false;
	let pid: number | null = null;

	if (fs.existsSync(pidFile)) {
		pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
		try {
			process.kill(pid, 0);
			isRunning = true;
		} catch {
			isRunning = false;
		}
	}

	if (isRunning) {
		console.log(
			chalk.dim("Status:   ") +
				chalk.green("● Running") +
				chalk.dim(` (PID: ${pid})`),
		);
	} else {
		console.log(chalk.dim("Status:   ") + chalk.red("○ Stopped"));
	}

	console.log(`${chalk.dim("Interval: ")}${config.pollInterval}s`);
	console.log(chalk.dim("Project:  ") + config.thingsProject);

	// Sync status
	console.log(chalk.bold("\nSync"));
	console.log(chalk.dim("────"));

	if (state.lastSync) {
		const lastSync = new Date(state.lastSync);
		const ago = Math.round((Date.now() - lastSync.getTime()) / 1000);
		console.log(chalk.dim("Last sync: ") + formatTimeAgo(ago));
	} else {
		console.log(`${chalk.dim("Last sync: ")}Never`);
	}

	if (state.lastError) {
		console.log(chalk.dim("Last error: ") + chalk.red(state.lastError));
	}

	// Task mappings
	const mappings = Object.values(state.mappings);
	console.log(chalk.bold(`\nTracked Tasks: `) + mappings.length);

	if (mappings.length > 0) {
		console.log(chalk.dim("───────────────"));

		// Group by type
		const byType = {
			"pr-review": mappings.filter((m) => m.type === "pr-review"),
			"pr-created": mappings.filter((m) => m.type === "pr-created"),
			"issue-assigned": mappings.filter((m) => m.type === "issue-assigned"),
			"issue-created": mappings.filter((m) => m.type === "issue-created"),
		};

		if (byType["pr-review"].length > 0) {
			console.log(
				chalk.cyan(`\n🔍 PR Reviews (${byType["pr-review"].length})`),
			);
			byType["pr-review"].slice(0, 5).forEach((m) => {
				console.log(chalk.dim("   • ") + m.title);
			});
		}

		if (byType["pr-created"].length > 0) {
			console.log(chalk.cyan(`\n📝 Your PRs (${byType["pr-created"].length})`));
			byType["pr-created"].slice(0, 5).forEach((m) => {
				console.log(chalk.dim("   • ") + m.title);
			});
		}

		if (byType["issue-assigned"].length > 0) {
			console.log(
				chalk.cyan(`\n📌 Assigned Issues (${byType["issue-assigned"].length})`),
			);
			byType["issue-assigned"].slice(0, 5).forEach((m) => {
				console.log(chalk.dim("   • ") + m.title);
			});
		}

		if (byType["issue-created"].length > 0) {
			console.log(
				chalk.cyan(`\n✏️  Your Issues (${byType["issue-created"].length})`),
			);
			byType["issue-created"].slice(0, 5).forEach((m) => {
				console.log(chalk.dim("   • ") + m.title);
			});
		}
	}

	console.log("");
}

function formatTimeAgo(seconds: number): string {
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
	return `${Math.round(seconds / 86400)}d ago`;
}
