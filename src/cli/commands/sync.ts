/**
 * sync command - Run a single sync (no daemon)
 */

import chalk from "chalk";
import { runSync } from "../../daemon/sync.js";
import { loadConfig } from "../../state/config.js";

interface SyncOptions {
	verbose?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
	const config = loadConfig();
	if (!config) {
		console.error(
			chalk.red("❌ Not configured. Run `github-things-sync init` first."),
		);
		process.exit(1);
	}

	console.log(chalk.cyan("🔄 Syncing...\n"));

	try {
		const result = await runSync(config, options.verbose ?? false);

		console.log(chalk.green("\n✅ Sync complete"));
		console.log(`${chalk.dim("   Created:   ")}${result.created} tasks`);
		console.log(`${chalk.dim("   Completed: ")}${result.completed} tasks`);
		console.log(`${chalk.dim("   Unchanged: ")}${result.unchanged} tasks`);

		if (result.errors.length > 0) {
			console.log(
				chalk.dim("   Errors:    ") + chalk.yellow(`${result.errors.length}`),
			);
			for (const err of result.errors) {
				console.log(`${chalk.dim("     • ")}${chalk.red(err)}`);
			}
		}
	} catch (error) {
		console.error(chalk.red(`❌ Sync failed: ${error}`));
		process.exit(1);
	}
}
