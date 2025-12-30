/**
 * config command - View and update settings
 */

import { password } from "@inquirer/prompts";
import { Octokit } from "@octokit/rest";
import chalk from "chalk";
import ora from "ora";
import {
	installLaunchAgent,
	uninstallLaunchAgent,
} from "../../daemon/launchagent.js";
import { GitHubClient } from "../../github/client.js";
import { loadConfig, saveConfig } from "../../state/config.js";
import type { Config, SyncType } from "../../types/index.js";
import { ALL_SYNC_TYPES } from "../../types/index.js";
import { formatRepoFilter, selectRepos } from "../repo-selector.js";

interface ConfigOptions {
	interval?: string;
	autostart?: string;
	project?: string;
	githubToken?: string;
	thingsToken?: string;
	syncTypes?: string;
	repos?: string;
	verify?: boolean;
	show?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
	const config = loadConfig();
	if (!config) {
		console.error(
			chalk.red("❌ Not configured. Run `github-things-sync init` first."),
		);
		process.exit(1);
	}

	// Check if any update option was provided
	const hasUpdateOption =
		options.interval !== undefined ||
		options.autostart !== undefined ||
		options.project !== undefined ||
		options.githubToken !== undefined ||
		options.thingsToken !== undefined ||
		options.syncTypes !== undefined ||
		options.repos !== undefined ||
		options.verify;

	// Show current config if no update options provided
	if (options.show || !hasUpdateOption) {
		await showConfig(config);
		return;
	}

	// Verify tokens
	if (options.verify) {
		await verifyTokens(config);
		return;
	}

	// Update settings
	let changed = false;

	if (options.interval !== undefined) {
		const interval = Number.parseInt(options.interval, 10);
		if (Number.isNaN(interval) || interval < 60) {
			console.error(chalk.red("❌ Interval must be at least 60 seconds"));
			process.exit(1);
		}
		config.pollInterval = interval;
		console.log(chalk.green(`✅ Poll interval set to ${interval}s`));
		changed = true;
	}

	if (options.autostart !== undefined) {
		const enabled = options.autostart === "true" || options.autostart === "on";
		const disabled =
			options.autostart === "false" || options.autostart === "off";

		if (!enabled && !disabled) {
			console.error(chalk.red("❌ Use --autostart=true or --autostart=false"));
			process.exit(1);
		}

		config.autoStart = enabled;

		if (enabled) {
			installLaunchAgent();
			console.log(chalk.green("✅ Autostart enabled (LaunchAgent installed)"));
		} else {
			uninstallLaunchAgent();
			console.log(chalk.green("✅ Autostart disabled (LaunchAgent removed)"));
		}
		changed = true;
	}

	if (options.project !== undefined) {
		config.thingsProject = options.project;
		console.log(chalk.green(`✅ Things project set to "${options.project}"`));
		changed = true;
	}

	if (options.githubToken !== undefined) {
		const token =
			options.githubToken === "prompt"
				? await password({
						message: "New GitHub Token",
						mask: "*",
						validate: (value) => (value ? true : "Token is required"),
					})
				: options.githubToken;

		config.githubToken = token;
		console.log(chalk.green("✅ GitHub token updated"));
		changed = true;
	}

	if (options.thingsToken !== undefined) {
		const token =
			options.thingsToken === "prompt"
				? await password({
						message: "New Things Auth Token",
						mask: "*",
						validate: (value) => (value ? true : "Token is required"),
					})
				: options.thingsToken;

		config.thingsAuthToken = token;
		console.log(chalk.green("✅ Things auth token updated"));
		changed = true;
	}

	if (options.syncTypes !== undefined) {
		let syncTypes: SyncType[];
		if (options.syncTypes.toLowerCase() === "all") {
			syncTypes = [...ALL_SYNC_TYPES];
		} else {
			const requested = options.syncTypes
				.split(",")
				.map((s) => s.trim()) as SyncType[];
			const valid = requested.filter((t) => ALL_SYNC_TYPES.includes(t));
			if (valid.length === 0) {
				console.error(
					chalk.red(
						"❌ No valid sync types. Use: pr-reviews, prs-created, issues-assigned, issues-created",
					),
				);
				process.exit(1);
			}
			syncTypes = valid;
		}
		config.syncTypes = syncTypes;
		console.log(chalk.green(`✅ Sync types set to: ${syncTypes.join(", ")}`));
		changed = true;
	}

	if (options.repos !== undefined) {
		if (options.repos.toLowerCase() === "all") {
			config.repoFilter = { mode: "all", repos: [] };
			console.log(chalk.green("✅ Repository scope set to: all repositories"));
			changed = true;
		} else if (options.repos === "prompt") {
			const spinner = ora("Fetching your repositories...").start();
			try {
				const client = new GitHubClient(config.githubToken);
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

				config.repoFilter = await selectRepos(groupedRepos, config.repoFilter);
				console.log(
					chalk.green(
						`✅ Repository scope set to: ${formatRepoFilter(config.repoFilter)}`,
					),
				);
				changed = true;
			} catch (error) {
				spinner.fail("Failed to fetch repositories");
				console.error(chalk.red(`❌ ${error}`));
				process.exit(1);
			}
		} else {
			console.error(
				chalk.red("❌ Use --repos=all or --repos=prompt to configure repos"),
			);
			process.exit(1);
		}
	}

	if (changed) {
		saveConfig(config);
		console.log(
			chalk.dim(
				"\n💾 Config saved. Restart daemon for changes to take effect.",
			),
		);
	}
}

async function showConfig(config: Config): Promise<void> {
	console.log(chalk.bold("\n⚙️  github-things-sync config\n"));
	console.log(chalk.bold("Settings"));
	console.log(chalk.dim("────────"));
	console.log(chalk.dim("Project:       ") + config.thingsProject);
	console.log(
		chalk.dim("Poll interval: ") +
			`${config.pollInterval}s (${config.pollInterval / 60} min)`,
	);
	console.log(
		chalk.dim("Autostart:     ") +
			(config.autoStart ? chalk.green("✅ enabled") : chalk.red("❌ disabled")),
	);
	console.log(
		chalk.dim("Sync types:    ") +
			(config.syncTypes?.join(", ") || "all (default)"),
	);
	console.log(
		chalk.dim("Repo scope:    ") + formatRepoFilter(config.repoFilter),
	);
	console.log("");
	console.log(chalk.bold("Tokens"));
	console.log(chalk.dim("──────"));
	console.log(chalk.dim("GitHub:        ") + maskToken(config.githubToken));
	console.log(chalk.dim("Things:        ") + maskToken(config.thingsAuthToken));
	console.log("");
	console.log(chalk.bold("Usage"));
	console.log(chalk.dim("─────"));
	console.log(
		`${chalk.dim("  --interval=SECONDS    ")}Set poll interval (min: 60)`,
	);
	console.log(
		`${chalk.dim("  --autostart=true|false ")}Enable/disable autostart`,
	);
	console.log(
		`${chalk.dim("  --project=NAME        ")}Set Things project name`,
	);
	console.log(`${chalk.dim("  --github-token=prompt ")}Update GitHub token`);
	console.log(`${chalk.dim("  --things-token=prompt ")}Update Things token`);
	console.log(
		chalk.dim("  --sync-types=TYPES    ") +
			'Set sync types (comma-separated or "all")',
	);
	console.log(
		`${chalk.dim("  --repos=all|prompt    ")}Set repo filter (all or select)`,
	);
	console.log(`${chalk.dim("  --verify              ")}Verify tokens work`);
	console.log("");
}

function maskToken(token: string): string {
	if (token.length <= 8) return "****";
	return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

async function verifyTokens(config: Config): Promise<void> {
	console.log(chalk.bold("\n🔍 Verifying tokens...\n"));

	// Verify GitHub token
	console.log(chalk.bold("GitHub Token"));
	console.log(chalk.dim("────────────"));
	try {
		const octokit = new Octokit({ auth: config.githubToken });
		const { data } = await octokit.users.getAuthenticated();
		console.log(
			`${chalk.green(`✅ Valid`)} - logged in as @${chalk.cyan(data.login)}`,
		);

		// Check scopes
		const response = await octokit.request("GET /user");
		const scopes = response.headers["x-oauth-scopes"] || "";
		console.log(chalk.dim(`   Scopes: ${scopes || "(none visible)"}`));
	} catch (error) {
		console.log(`${chalk.red(`❌ Invalid`)} - ${error}`);
	}

	// Verify Things token (we can only check if Things is running)
	console.log(chalk.bold("\nThings Auth Token"));
	console.log(chalk.dim("─────────────────"));
	try {
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const execAsync = promisify(exec);

		await execAsync(
			"osascript -e 'tell application \"Things3\" to return name'",
		);
		console.log(chalk.green("✅ Things 3 is running"));
		console.log(chalk.dim(`   Token: ${maskToken(config.thingsAuthToken)}`));
		console.log(
			chalk.dim("   (Token validity is checked when updating tasks)"),
		);
	} catch {
		console.log(chalk.yellow("⚠️  Things 3 is not running"));
	}

	console.log("");
}
