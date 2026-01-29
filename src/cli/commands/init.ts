/**
 * init command - Interactive setup wizard
 */

import { checkbox, confirm, input, password } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { installLaunchAgent } from "../../daemon/launchagent.js";
import { GitHubClient } from "../../github/client.js";
import {
	getConfigPath,
	getDataDir,
	loadConfig,
	saveConfig,
} from "../../state/config.js";
import type { Config, RepoFilter, SyncType } from "../../types/index.js";
import { ALL_SYNC_TYPES } from "../../types/index.js";
import { formatRepoFilter, selectRepos } from "../repo-selector.js";

function maskToken(token: string): string {
	if (token.length <= 8) return "****";
	return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export async function initCommand(): Promise<void> {
	console.log(chalk.bold("\n🔧 github-things-sync setup\n"));

	// Check for existing config
	const existing = loadConfig();
	if (existing) {
		console.log(chalk.yellow("⚠️  Existing configuration found.\n"));
		console.log("Current settings:");
		console.log(
			chalk.dim("  GitHub Token:  ") + maskToken(existing.githubToken),
		);
		console.log(
			chalk.dim("  Things Token:  ") + maskToken(existing.thingsAuthToken),
		);
		console.log(chalk.dim("  Project:       ") + existing.thingsProject);
		console.log(
			chalk.dim("  Area:          ") + (existing.thingsArea || "(none)"),
		);
		console.log(`${chalk.dim("  Poll Interval: ") + existing.pollInterval}s`);
		console.log(
			chalk.dim("  Sync Types:    ") +
				(existing.syncTypes?.join(", ") || "all"),
		);
		console.log(
			chalk.dim("  Repo Scope:    ") + formatRepoFilter(existing.repoFilter),
		);
		console.log(
			chalk.dim("  Autostart:     ") +
				(existing.autoStart ? "yes" : "no") +
				"\n",
		);

		const overwrite = await confirm({
			message: "Reconfigure?",
			default: false,
		});

		if (!overwrite) {
			console.log(chalk.green("\n✅ Keeping existing configuration."));
			console.log(
				chalk.dim(
					"Use `github-things-sync config` to update individual settings.\n",
				),
			);
			return;
		}
		console.log("");
	}

	console.log(
		"This wizard will configure the sync between GitHub and Things 3.\n",
	);

	// Step 1: GitHub Token
	console.log(chalk.bold("Step 1: GitHub Personal Access Token"));
	console.log(chalk.dim("─────────────────────────────────────"));
	console.log(
		chalk.dim("Create a classic token at: ") +
			chalk.cyan("https://github.com/settings/tokens/new"),
	);
	console.log(
		chalk.dim("(Fine-grained tokens may not work with organization repos)"),
	);
	console.log(chalk.dim("Required scope: repo\n"));

	const githubToken =
		(await password({
			message: "GitHub Token",
			mask: "*",
			validate: (value) => {
				if (!value && !existing?.githubToken) {
					return "GitHub token is required";
				}
				return true;
			},
		})) || existing?.githubToken;

	if (!githubToken) {
		console.error(chalk.red("❌ GitHub token is required"));
		process.exit(1);
	}

	// Step 2: Things Auth Token
	console.log(chalk.bold("\nStep 2: Things Auth Token"));
	console.log(chalk.dim("─────────────────────────"));
	console.log(
		chalk.dim(
			"Find it in: Things → Settings → General → Things URLs → Manage\n",
		),
	);

	const thingsAuthToken =
		(await password({
			message: "Things Auth Token",
			mask: "*",
			validate: (value) => {
				if (!value && !existing?.thingsAuthToken) {
					return "Things auth token is required for auto-completing tasks";
				}
				return true;
			},
		})) || existing?.thingsAuthToken;

	if (!thingsAuthToken) {
		console.error(chalk.red("❌ Things auth token is required"));
		process.exit(1);
	}

	// Step 3: Things Project
	console.log(chalk.bold("\nStep 3: Things Project"));
	console.log(chalk.dim("──────────────────────"));
	console.log(
		chalk.dim("Tasks will be created in this project (must exist in Things)\n"),
	);

	const thingsProject = await input({
		message: "Project name",
		default: existing?.thingsProject || "GitHub",
		validate: (value) => {
			if (!value.trim()) {
				return "Project name is required";
			}
			return true;
		},
	});

	console.log(
		chalk.dim(
			"\nOptional: assign the project to a Things area so tasks appear in Today.\n",
		),
	);

	const thingsArea =
		(await input({
			message: "Area name (leave empty to skip)",
			default: existing?.thingsArea || "",
		})) || undefined;

	// Step 4: Poll Interval
	console.log(chalk.bold("\nStep 4: Poll Interval"));
	console.log(chalk.dim("─────────────────────"));
	console.log(
		chalk.dim("How often to check GitHub for updates (in seconds)\n"),
	);

	const pollIntervalStr = await input({
		message: "Interval (seconds)",
		default: String(existing?.pollInterval || 300),
		validate: (value) => {
			const num = Number.parseInt(value, 10);
			if (Number.isNaN(num) || num < 60) {
				return "Interval must be at least 60 seconds";
			}
			return true;
		},
	});
	const pollInterval = Number.parseInt(pollIntervalStr, 10);

	// Step 5: Sync Types
	console.log(chalk.bold("\nStep 5: Sync Types"));
	console.log(chalk.dim("──────────────────"));
	console.log(chalk.dim("Which GitHub items should be synced to Things?\n"));

	const defaultSyncTypes = existing?.syncTypes || [...ALL_SYNC_TYPES];
	const syncTypes = await checkbox<SyncType>({
		message: "Select sync types",
		choices: [
			{
				name: "PR Reviews - PRs where you are requested as reviewer",
				value: "pr-reviews" as SyncType,
				checked: defaultSyncTypes.includes("pr-reviews"),
			},
			{
				name: "PRs Created - PRs you created",
				value: "prs-created" as SyncType,
				checked: defaultSyncTypes.includes("prs-created"),
			},
			{
				name: "Issues Assigned - Issues assigned to you",
				value: "issues-assigned" as SyncType,
				checked: defaultSyncTypes.includes("issues-assigned"),
			},
			{
				name: "Issues Created - Issues you created",
				value: "issues-created" as SyncType,
				checked: defaultSyncTypes.includes("issues-created"),
			},
		],
		validate: (value) => {
			if (value.length === 0) {
				return "Select at least one sync type";
			}
			return true;
		},
	});

	// Step 6: Repository Scope
	console.log(chalk.bold("\nStep 6: Repository Scope"));
	console.log(chalk.dim("────────────────────────"));
	console.log(chalk.dim("Which repositories should be synced to Things?\n"));

	const spinner = ora("Fetching your repositories...").start();
	let repoFilter: RepoFilter = { mode: "all", repos: [] };

	try {
		const client = new GitHubClient(githubToken);
		const groupedRepos = await client.fetchAllRepos();
		spinner.stop();

		const totalRepos = Object.values(groupedRepos).reduce(
			(sum, repos) => sum + repos.length,
			0,
		);
		const ownerCount = Object.keys(groupedRepos).length;
		console.log(
			chalk.dim(
				`Found ${totalRepos} repositories across ${ownerCount} owner${ownerCount === 1 ? "" : "s"}.\n`,
			),
		);

		repoFilter = await selectRepos(groupedRepos, existing?.repoFilter);
	} catch (error) {
		spinner.fail("Failed to fetch repositories");
		console.log(
			chalk.yellow(
				"⚠️  Could not fetch repositories. Defaulting to sync all repos.",
			),
		);
		console.log(chalk.dim(`   Error: ${error}\n`));
	}

	// Step 7: Auto-start
	console.log(chalk.bold("\nStep 7: Auto-start"));
	console.log(chalk.dim("──────────────────"));
	console.log(chalk.dim("Start automatically when you log in to your Mac?\n"));

	const autoStart = await confirm({
		message: "Enable auto-start?",
		default: existing?.autoStart !== false,
	});

	// Save config
	const config: Config = {
		githubToken,
		thingsProject,
		thingsArea,
		thingsAuthToken,
		pollInterval,
		autoStart,
		syncTypes,
		repoFilter,
	};

	saveConfig(config);

	console.log(chalk.green(`\n✅ Configuration saved to ${getConfigPath()}`));

	// Install LaunchAgent if requested
	if (autoStart) {
		installLaunchAgent();
		console.log(chalk.green("✅ LaunchAgent installed (auto-start enabled)"));
	}

	console.log(
		chalk.green("\n🎉 Setup complete!") +
			" Run `github-things-sync start` to begin syncing.\n",
	);
	console.log(chalk.dim("📁 Data directory: ") + getDataDir());
	console.log(
		chalk.dim('📋 Make sure the project "') +
			chalk.cyan(thingsProject) +
			chalk.dim('" exists in Things 3\n'),
	);
}
