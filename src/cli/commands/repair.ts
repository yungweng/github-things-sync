/**
 * repair command - Fix broken url- task IDs in state by matching Things tasks
 *
 * When AppleScript creation failed in the past, fake "url-<timestamp>" IDs were
 * stored. This command finds the real Things IDs by matching task titles.
 */

import chalk from "chalk";
import { loadState, saveState } from "../../state/state.js";
import { ThingsClient } from "../../things/client.js";
import type { GitHubItemType } from "../../types/index.js";

const TITLE_PREFIXES: Record<GitHubItemType, string> = {
	"pr-review": "Review",
	"pr-created": "PR",
	"issue-assigned": "Issue",
	"issue-created": "My Issue",
};

/**
 * Reconstruct the formatted Things title from state data.
 * Must match ThingsClient.formatTitle() output.
 */
function reconstructThingsTitle(
	type: GitHubItemType,
	rawTitle: string,
	url: string,
): string {
	const prefix = TITLE_PREFIXES[type];
	// Extract short repo name from URL like "https://github.com/owner/repo/..."
	const parts = url.split("/");
	const repoIdx = parts.indexOf("github.com");
	const shortRepo =
		repoIdx >= 0 && parts.length > repoIdx + 2 ? parts[repoIdx + 2] : "unknown";
	return `${prefix}: ${rawTitle} (${shortRepo})`;
}

export async function repairCommand(): Promise<void> {
	const state = loadState();
	const entries = Object.entries(state.mappings);
	const broken = entries.filter(([, m]) => m.thingsId.startsWith("url-"));

	if (broken.length === 0) {
		console.log(chalk.green("✅ No broken mappings found. All IDs are valid."));
		return;
	}

	console.log(
		chalk.yellow(
			`🔧 Found ${broken.length} broken mapping(s) with fake url- IDs\n`,
		),
	);

	let repaired = 0;
	let notFound = 0;
	const removed: string[] = [];

	for (const [githubId, mapping] of broken) {
		const thingsTitle = reconstructThingsTitle(
			mapping.type,
			mapping.title,
			mapping.url,
		);
		const realId = ThingsClient.findTaskByTitle(thingsTitle);

		if (realId) {
			state.mappings[githubId] = { ...mapping, thingsId: realId };
			repaired++;
			console.log(
				`  ${chalk.green("✓")} ${chalk.dim(mapping.title)}\n    ${chalk.dim(`${mapping.thingsId} → ${realId}`)}`,
			);
		} else {
			// Task not found in Things — remove stale mapping
			delete state.mappings[githubId];
			removed.push(mapping.title);
			notFound++;
			console.log(
				`  ${chalk.red("✗")} ${chalk.dim(mapping.title)}\n    ${chalk.dim("Not found in Things — removed from state")}`,
			);
		}
	}

	saveState(state);

	console.log(chalk.cyan("\n📊 Results:"));
	console.log(`   Repaired:  ${chalk.green(String(repaired))}`);
	console.log(`   Removed:   ${chalk.yellow(String(notFound))}`);
	console.log(
		`   Total:     ${Object.keys(state.mappings).length} mappings remaining`,
	);

	if (repaired > 0) {
		console.log(
			chalk.green(
				"\n✅ State repaired. Future syncs will use real Things IDs.",
			),
		);
	}
}
