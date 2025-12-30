/**
 * GitHub API client
 */

import { Octokit } from "@octokit/rest";
import type {
	GitHubItem,
	GitHubItemType,
	RepoFilter,
	SyncType,
} from "../types/index.js";

export interface RepoInfo {
	fullName: string; // "owner/repo"
	name: string;
	owner: string;
	isPrivate: boolean;
}

export interface GroupedRepos {
	[owner: string]: RepoInfo[];
}

export class GitHubClient {
	private octokit: Octokit;
	private username: string | null = null;
	private syncTypes: SyncType[];
	private repoFilter?: RepoFilter;

	constructor(token: string, syncTypes?: SyncType[], repoFilter?: RepoFilter) {
		this.octokit = new Octokit({ auth: token });
		this.syncTypes = syncTypes || [
			"pr-reviews",
			"prs-created",
			"issues-assigned",
			"issues-created",
		];
		this.repoFilter = repoFilter;
	}

	async getUsername(): Promise<string> {
		if (this.username) return this.username;

		const { data } = await this.octokit.users.getAuthenticated();
		this.username = data.login;
		return this.username;
	}

	/**
	 * Fetch all repositories the user has access to, grouped by owner
	 */
	async fetchAllRepos(): Promise<GroupedRepos> {
		const repos: RepoInfo[] = [];
		let page = 1;

		// Paginate through all repos
		while (true) {
			const { data } = await this.octokit.repos.listForAuthenticatedUser({
				per_page: 100,
				page,
				sort: "full_name",
			});

			if (data.length === 0) break;

			for (const repo of data) {
				repos.push({
					fullName: repo.full_name,
					name: repo.name,
					owner: repo.owner?.login || "unknown",
					isPrivate: repo.private,
				});
			}

			page++;
		}

		// Group by owner
		const grouped: GroupedRepos = {};
		for (const repo of repos) {
			if (!grouped[repo.owner]) {
				grouped[repo.owner] = [];
			}
			grouped[repo.owner].push(repo);
		}

		// Sort repos within each owner
		for (const owner of Object.keys(grouped)) {
			grouped[owner].sort((a, b) => a.name.localeCompare(b.name));
		}

		return grouped;
	}

	/**
	 * Check if a repo should be included based on filter
	 */
	private shouldIncludeRepo(repoFullName: string): boolean {
		if (!this.repoFilter || this.repoFilter.mode === "all") {
			return true;
		}
		return this.repoFilter.repos.includes(repoFullName);
	}

	/**
	 * Fetch all items we care about from GitHub
	 */
	async fetchAllItems(): Promise<GitHubItem[]> {
		const username = await this.getUsername();
		const items: GitHubItem[] = [];

		// Build list of fetch promises based on enabled sync types
		const fetches: Promise<GitHubItem[]>[] = [];

		if (this.syncTypes.includes("pr-reviews")) {
			fetches.push(this.fetchPRReviewRequests(username));
		}
		if (this.syncTypes.includes("prs-created")) {
			fetches.push(this.fetchPRsCreated(username));
		}
		if (this.syncTypes.includes("issues-assigned")) {
			fetches.push(this.fetchIssuesAssigned(username));
		}
		if (this.syncTypes.includes("issues-created")) {
			fetches.push(this.fetchIssuesCreated(username));
		}

		// Fetch in parallel
		const results = await Promise.all(fetches);
		for (const result of results) {
			items.push(...result);
		}

		// Filter by repo if configured
		return items.filter((item) => this.shouldIncludeRepo(item.repo));
	}

	/**
	 * PRs where you're requested as reviewer
	 */
	private async fetchPRReviewRequests(username: string): Promise<GitHubItem[]> {
		const { data } = await this.octokit.search.issuesAndPullRequests({
			q: `is:pr is:open review-requested:${username}`,
			per_page: 100,
		});

		return data.items.map((item) => this.mapToGitHubItem(item, "pr-review"));
	}

	/**
	 * PRs you created
	 */
	private async fetchPRsCreated(username: string): Promise<GitHubItem[]> {
		const { data } = await this.octokit.search.issuesAndPullRequests({
			q: `is:pr is:open author:${username}`,
			per_page: 100,
		});

		return data.items.map((item) => this.mapToGitHubItem(item, "pr-created"));
	}

	/**
	 * Issues assigned to you
	 */
	private async fetchIssuesAssigned(username: string): Promise<GitHubItem[]> {
		const { data } = await this.octokit.search.issuesAndPullRequests({
			q: `is:issue is:open assignee:${username}`,
			per_page: 100,
		});

		return data.items.map((item) =>
			this.mapToGitHubItem(item, "issue-assigned"),
		);
	}

	/**
	 * Issues you created
	 */
	private async fetchIssuesCreated(username: string): Promise<GitHubItem[]> {
		const { data } = await this.octokit.search.issuesAndPullRequests({
			q: `is:issue is:open author:${username}`,
			per_page: 100,
		});

		return data.items.map((item) =>
			this.mapToGitHubItem(item, "issue-created"),
		);
	}

	/**
	 * Check if an item is still open
	 */
	async isItemOpen(item: GitHubItem): Promise<boolean> {
		// Extract owner/repo from URL
		// URL format: https://github.com/owner/repo/issues/123 or .../pull/123
		const match = item.url.match(/github\.com\/([^/]+)\/([^/]+)/);
		if (!match) return false;

		const [, owner, repo] = match;

		try {
			if (item.type.startsWith("pr-")) {
				const { data } = await this.octokit.pulls.get({
					owner,
					repo,
					pull_number: item.number,
				});
				return data.state === "open";
			} else {
				const { data } = await this.octokit.issues.get({
					owner,
					repo,
					issue_number: item.number,
				});
				return data.state === "open";
			}
		} catch {
			// If we can't fetch, assume it's closed
			return false;
		}
	}

	private mapToGitHubItem(
		item: {
			id: number;
			title: string;
			html_url: string;
			repository_url: string;
			number: number;
			state?: string;
			created_at: string;
			updated_at: string;
			pull_request?: unknown;
		},
		type: GitHubItemType,
	): GitHubItem {
		// Extract repo name from repository_url
		const repoMatch = item.repository_url.match(/repos\/(.+)$/);
		const repo = repoMatch ? repoMatch[1] : "unknown";

		return {
			id: item.id,
			type,
			title: item.title,
			url: item.html_url,
			repo,
			number: item.number,
			state: (item.state as "open" | "closed") ?? "open",
			createdAt: item.created_at,
			updatedAt: item.updated_at,
		};
	}
}
