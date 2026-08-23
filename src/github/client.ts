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

export interface FetchResult {
	items: GitHubItem[];
	incomplete: boolean; // true if any underlying search query returned incomplete_results
}

interface SearchPage<T> {
	items: T[];
	incomplete: boolean;
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
	 * Fetch all items we care about from GitHub.
	 * Returns `incomplete: true` if any underlying search query was flagged as
	 * incomplete by GitHub — callers should skip reconcile/complete logic in that
	 * case, otherwise tasks bounce (get completed and re-created on next sync).
	 */
	async fetchAllItems(): Promise<FetchResult> {
		const username = await this.getUsername();

		const fetches: Promise<SearchPage<GitHubItem>>[] = [];

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

		const results = await Promise.all(fetches);

		const items: GitHubItem[] = [];
		let incomplete = false;
		for (const result of results) {
			items.push(...result.items);
			if (result.incomplete) incomplete = true;
		}

		const filtered = items.filter((item) => this.shouldIncludeRepo(item.repo));
		return { items: filtered, incomplete };
	}

	private async runSearch(
		q: string,
		type: GitHubItemType,
	): Promise<SearchPage<GitHubItem>> {
		const { data } = await this.octokit.search.issuesAndPullRequests({
			q,
			per_page: 100,
		});
		return {
			items: data.items.map((item) => this.mapToGitHubItem(item, type)),
			incomplete: data.incomplete_results === true,
		};
	}

	private fetchPRReviewRequests(
		username: string,
	): Promise<SearchPage<GitHubItem>> {
		return this.runSearch(
			`is:pr is:open review-requested:${username}`,
			"pr-review",
		);
	}

	private fetchPRsCreated(username: string): Promise<SearchPage<GitHubItem>> {
		return this.runSearch(`is:pr is:open author:${username}`, "pr-created");
	}

	private fetchIssuesAssigned(
		username: string,
	): Promise<SearchPage<GitHubItem>> {
		return this.runSearch(
			`is:issue is:open assignee:${username}`,
			"issue-assigned",
		);
	}

	private fetchIssuesCreated(
		username: string,
	): Promise<SearchPage<GitHubItem>> {
		return this.runSearch(
			`is:issue is:open author:${username}`,
			"issue-created",
		);
	}

	/**
	 * Check if an item is still open
	 */
	async isItemOpen(item: GitHubItem): Promise<boolean> {
		return this.isOpenByUrl(item.url, item.type.startsWith("pr-"));
	}

	/**
	 * Verify if a GitHub item (by URL) is still open via the issues/pulls API.
	 *
	 * Returns:
	 *   - true  if the API confirms `state === "open"`
	 *   - false if the API confirms it's closed (404 included — item gone)
	 *   - null  if the call failed for transient reasons (rate-limit, network) —
	 *           caller should treat this as "unknown" and skip completing
	 */
	async verifyOpenByMapping(
		url: string,
		isPR: boolean,
	): Promise<boolean | null> {
		const match = url.match(
			/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/,
		);
		if (!match) return null;

		const [, owner, repo, numStr] = match;
		const number = Number(numStr);

		try {
			if (isPR) {
				const { data } = await this.octokit.pulls.get({
					owner,
					repo,
					pull_number: number,
				});
				return data.state === "open";
			} else {
				const { data } = await this.octokit.issues.get({
					owner,
					repo,
					issue_number: number,
				});
				return data.state === "open";
			}
		} catch (error) {
			const status = (error as { status?: number })?.status;
			if (status === 404 || status === 410) return false;
			return null;
		}
	}

	private async isOpenByUrl(url: string, isPR: boolean): Promise<boolean> {
		const result = await this.verifyOpenByMapping(url, isPR);
		return result === true;
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
