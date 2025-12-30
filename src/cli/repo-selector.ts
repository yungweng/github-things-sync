/**
 * Interactive repository selector UI
 */

import { checkbox, select } from "@inquirer/prompts";
import chalk from "chalk";
import type { GroupedRepos, RepoInfo } from "../github/client.js";
import type { RepoFilter } from "../types/index.js";

interface OwnerChoice {
	name: string;
	value: string;
	checked: boolean;
}

/**
 * Interactive two-step repo selector
 * 1. Select orgs/owners to include
 * 2. For each selected owner, pick repos
 */
export async function selectRepos(
	groupedRepos: GroupedRepos,
	existing?: RepoFilter,
): Promise<RepoFilter> {
	// First, ask if they want all repos or specific ones
	const scopeChoice = await select({
		message: "Which repositories should be synced?",
		choices: [
			{
				name: "All repositories (default)",
				value: "all",
			},
			{
				name: "Choose specific repositories",
				value: "selected",
			},
		],
		default: existing?.mode === "selected" ? "selected" : "all",
	});

	if (scopeChoice === "all") {
		return { mode: "all", repos: [] };
	}

	// Get owners sorted alphabetically
	const owners = Object.keys(groupedRepos).sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);

	if (owners.length === 0) {
		console.log(chalk.yellow("No repositories found."));
		return { mode: "all", repos: [] };
	}

	// Build owner choices with repo counts
	const ownerChoices: OwnerChoice[] = owners.map((owner) => {
		const repoCount = groupedRepos[owner].length;
		const hasSelectedRepos =
			existing?.mode === "selected" &&
			groupedRepos[owner].some((r) => existing.repos.includes(r.fullName));

		return {
			name: `${owner} (${repoCount} repo${repoCount === 1 ? "" : "s"})`,
			value: owner,
			checked: hasSelectedRepos || existing?.mode !== "selected",
		};
	});

	// Step 1: Select owners/orgs
	console.log("");
	const selectedOwners = await checkbox({
		message: "Select organizations/owners to include",
		choices: ownerChoices,
		pageSize: 15,
		validate: (value) => {
			if (value.length === 0) {
				return "Select at least one organization/owner";
			}
			return true;
		},
	});

	// Step 2: For each selected owner, pick repos
	const selectedRepos: string[] = [];

	for (const owner of selectedOwners) {
		const repos = groupedRepos[owner];

		// Build repo choices
		const repoChoices = repos.map((repo: RepoInfo) => {
			const isExistingSelected =
				existing?.mode === "selected" && existing.repos.includes(repo.fullName);
			const label = repo.isPrivate
				? `${repo.name} ${chalk.dim("(private)")}`
				: repo.name;

			return {
				name: label,
				value: repo.fullName,
				checked: isExistingSelected || existing?.mode !== "selected",
			};
		});

		console.log("");
		const ownerRepos = await checkbox({
			message: `Select repositories from ${chalk.cyan(owner)}`,
			choices: repoChoices,
			pageSize: 15,
		});

		selectedRepos.push(...ownerRepos);
	}

	if (selectedRepos.length === 0) {
		console.log(
			chalk.yellow("\n⚠️  No repositories selected. Defaulting to all repos."),
		);
		return { mode: "all", repos: [] };
	}

	console.log(
		chalk.dim(
			`\n${selectedRepos.length} repositor${selectedRepos.length === 1 ? "y" : "ies"} selected.`,
		),
	);

	return {
		mode: "selected",
		repos: selectedRepos.sort(),
	};
}

/**
 * Format repo filter for display
 */
export function formatRepoFilter(filter?: RepoFilter): string {
	if (!filter || filter.mode === "all") {
		return "all repositories";
	}

	const count = filter.repos.length;
	if (count === 0) {
		return "all repositories";
	}

	if (count <= 3) {
		return filter.repos.join(", ");
	}

	return `${count} repositories`;
}
