/**
 * Types for github-things-sync
 */

// GitHub item types we track
export type GitHubItemType =
	| "pr-review" // PR where you're requested as reviewer
	| "pr-created" // PR you created
	| "issue-assigned" // Issue assigned to you
	| "issue-created"; // Issue you created

// Sync type identifiers for config
export type SyncType =
	| "pr-reviews"
	| "prs-created"
	| "issues-assigned"
	| "issues-created";

// All available sync types (for validation)
export const ALL_SYNC_TYPES: SyncType[] = [
	"pr-reviews",
	"prs-created",
	"issues-assigned",
	"issues-created",
];

// A GitHub item (PR or Issue)
export interface GitHubItem {
	id: number;
	type: GitHubItemType;
	title: string;
	url: string;
	repo: string;
	number: number;
	state: "open" | "closed" | "merged";
	createdAt: string;
	updatedAt: string;
}

// Mapping between GitHub item and Things task
export interface TaskMapping {
	githubId: string; // e.g., "pr:123456" or "issue:789"
	thingsId: string; // Things task ID returned from URL scheme
	type: GitHubItemType;
	title: string;
	url: string;
	createdAt: string;
	completedAt?: string;
}

// Persisted state
export interface SyncState {
	mappings: Record<string, TaskMapping>;
	lastSync: string | null;
	lastError: string | null;
}

// Repository filter configuration
export interface RepoFilter {
	mode: "all" | "selected";
	repos: string[]; // Format: "owner/repo"
}

// User configuration
export interface Config {
	githubToken: string;
	thingsProject: string; // Default: "GitHub"
	thingsAuthToken: string; // Required for updating tasks
	pollInterval: number; // Seconds, default: 300 (5 min)
	autoStart: boolean; // Install LaunchAgent
	syncTypes: SyncType[]; // Which item types to sync (default: all)
	repoFilter?: RepoFilter; // Which repos to sync (undefined = all)
}

// Daemon status
export interface DaemonStatus {
	running: boolean;
	pid: number | null;
	lastSync: string | null;
	lastError: string | null;
	taskCount: number;
	uptime: number | null; // Seconds
}
