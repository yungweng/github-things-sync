/**
 * Daemon entry point - runs the sync loop
 */

import { loadConfig } from "../state/config.js";
import { setLastError } from "../state/state.js";
import { runSync } from "./sync.js";

async function main() {
	const config = loadConfig();
	if (!config) {
		console.error("Not configured. Run `github-things-sync init` first.");
		process.exit(1);
	}

	console.log(`[${timestamp()}] Daemon started`);
	console.log(`[${timestamp()}] Poll interval: ${config.pollInterval}s`);
	console.log(`[${timestamp()}] Things project: ${config.thingsProject}`);

	// Handle shutdown gracefully
	process.on("SIGTERM", () => {
		console.log(`[${timestamp()}] Received SIGTERM, shutting down`);
		process.exit(0);
	});

	process.on("SIGINT", () => {
		console.log(`[${timestamp()}] Received SIGINT, shutting down`);
		process.exit(0);
	});

	// Initial sync
	await doSync(config);

	// Start poll loop
	setInterval(() => doSync(config), config.pollInterval * 1000);
}

async function doSync(config: ReturnType<typeof loadConfig>) {
	if (!config) return;

	console.log(`[${timestamp()}] Starting sync...`);

	try {
		const result = await runSync(config, false);
		console.log(
			`[${timestamp()}] Sync complete: ` +
				`+${result.created} created, ` +
				`✓${result.completed} completed, ` +
				`=${result.unchanged} unchanged`,
		);

		if (result.errors.length > 0) {
			result.errors.forEach((err) => {
				console.error(`[${timestamp()}] Error: ${err}`);
			});
		}
	} catch (error) {
		const msg = `Sync failed: ${error}`;
		console.error(`[${timestamp()}] ${msg}`);
		setLastError(msg);
	}
}

function timestamp(): string {
	return new Date().toISOString().replace("T", " ").slice(0, 19);
}

main().catch((error) => {
	console.error(`[${timestamp()}] Fatal error: ${error}`);
	process.exit(1);
});
