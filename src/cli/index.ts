#!/usr/bin/env node

/**
 * CLI entry point for github-things-sync
 */

import * as fs from "node:fs";
import chalk from "chalk";
import { Command } from "commander";
import updateNotifier from "update-notifier";
import { configCommand } from "./commands/config.js";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";
import { syncCommand } from "./commands/sync.js";

// Load package.json for version info
// In dev: src/cli/index.ts -> ../../package.json
// In prod: dist/index.js -> ../package.json
const pkgPath = new URL("../package.json", import.meta.url);
const pkgPathAlt = new URL("../../package.json", import.meta.url);
const pkg = JSON.parse(
	fs.existsSync(pkgPath)
		? fs.readFileSync(pkgPath, "utf-8")
		: fs.readFileSync(pkgPathAlt, "utf-8"),
);
const updateCheckInterval = 1000 * 60 * 60; // 1 hour

// updateNotifier() calls check() which loads cached update into notifier.update
// and clears the cache (by design - it's a one-time read)
const notifier = updateNotifier({ pkg, updateCheckInterval });

// Validate cached update against current version (user may have upgraded)
if (notifier.update) {
	notifier.update.current = pkg.version;
	// Clear if no longer outdated
	if (notifier.update.current === notifier.update.latest) {
		notifier.update = undefined;
	}
}

// Detect first run: lastUpdateCheck was just set by constructor (within last second)
const lastCheck = (notifier.config?.get("lastUpdateCheck") as number) ?? 0;
const isFirstRun = Date.now() - lastCheck < 1000;
const intervalPassed = Date.now() - lastCheck >= updateCheckInterval;

// Fetch immediately if no cached update and (first run OR interval passed)
// This fixes the 24h delay issue where check() skips spawning on first run
if (!notifier.update && (isFirstRun || intervalPassed)) {
	try {
		const update = await notifier.fetchInfo();
		notifier.config?.set("lastUpdateCheck", Date.now());
		if (update && update.type !== "latest") {
			notifier.update = update;
		}
	} catch {
		// Ignore network errors
	}
}

// Re-cache update for next run (check() deleted it when reading)
// Only cache if there's actually an update available
if (notifier.update && notifier.update.current !== notifier.update.latest) {
	notifier.config?.set("update", notifier.update);
} else {
	notifier.config?.delete("update");
}

// Show notification on exit (bypasses TTY check that blocks notify())
process.on("exit", () => {
	if (notifier.update && notifier.update.current !== notifier.update.latest) {
		console.error(
			chalk.yellow(
				`\n  Update available: ${notifier.update.current} → ${notifier.update.latest}`,
			) + chalk.dim(`\n  Run: npm i -g ${pkg.name}\n`),
		);
	}
});

const program = new Command();

program
	.name("github-things-sync")
	.description("Sync GitHub PRs and Issues to Things 3 on macOS")
	.version(pkg.version);

program
	.command("init")
	.description("Interactive setup wizard")
	.action(initCommand);

program
	.command("start")
	.description("Start the background daemon")
	.action(startCommand);

program.command("stop").description("Stop the daemon").action(stopCommand);

program
	.command("status")
	.description("Show sync status and recent activity")
	.action(statusCommand);

program
	.command("sync")
	.description("Run a single sync (no daemon)")
	.option("-v, --verbose", "Show detailed output")
	.action(syncCommand);

program
	.command("config")
	.description("View and update settings")
	.option("--show", "Show current config (default)")
	.option("--interval <seconds>", "Set poll interval (min: 60)")
	.option("--autostart <bool>", "Enable/disable autostart (true/false)")
	.option("--project <name>", "Set Things project name")
	.option(
		"--github-token <token>",
		'Update GitHub token (use "prompt" for interactive)',
	)
	.option(
		"--things-token <token>",
		'Update Things token (use "prompt" for interactive)',
	)
	.option("--sync-types <types>", 'Set sync types (comma-separated or "all")')
	.option("--verify", "Verify tokens work")
	.action(configCommand);

program.parse();
