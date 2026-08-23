/**
 * Things 3 client using AppleScript (create/complete) and URL Scheme (fallback updates)
 *
 * Modeled after shared-things' proven approach:
 * - AppleScript for creation (returns real Things ID atomically)
 * - AppleScript for completion (reliable with real IDs)
 * - No URL scheme fallback for creation (fake IDs break updates)
 *
 * Uses project IDs instead of names because Things' AppleScript `project "Name"`
 * lookup is broken for projects created via URL scheme — only `project id "X"` works.
 */

import { execSync } from "node:child_process";
import type { GitHubItem, GitHubItemType } from "../types/index.js";

function runAppleScript(script: string): string {
	const result = execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
		encoding: "utf-8",
		maxBuffer: 10 * 1024 * 1024,
	}).trim();
	return result;
}

export class ThingsClient {
	private projectName: string;
	private area?: string;
	private projectId: string | null = null;

	constructor(project: string, _authToken: string, area?: string) {
		this.projectName = project;
		this.area = area;
	}

	/**
	 * Resolve the project ID by searching projects directly by name (and area, if set).
	 * Only creates a new project when none matches — prevents duplicate-project bugs
	 * when the project temporarily has no todos in standard lists.
	 */
	async ensureProjectExists(): Promise<string> {
		if (this.projectId) return this.projectId;

		const escapedName = this.projectName.replace(/"/g, '\\"');
		const escapedArea = this.area ? this.area.replace(/"/g, '\\"') : null;

		const areaCheck = escapedArea
			? `
              try
                if name of area of p is "${escapedArea}" then
                  return id of p
                end if
              end try`
			: "\n              return id of p";

		const findScript = `
      tell application "Things3"
        repeat with p in projects
          if name of p is "${escapedName}" and (status of p as string) is "open" then${areaCheck}
          end if
        end repeat
        return "NOT_FOUND"
      end tell
    `;

		try {
			const result = runAppleScript(findScript);
			if (result !== "NOT_FOUND") {
				this.projectId = result;
				return this.projectId;
			}
		} catch {
			// Fall through to creation
		}

		const areaAssignment = escapedArea
			? `set area of newProj to area "${escapedArea}"`
			: "";

		const createScript = `
      tell application "Things3"
        set newProj to make new project with properties {name:"${escapedName}"}
        ${areaAssignment}
        return id of newProj
      end tell
    `;

		this.projectId = runAppleScript(createScript);
		console.log(`📁 Created Things project: ${this.projectName}`);
		return this.projectId;
	}

	/**
	 * Create a task in Things for a GitHub item.
	 * Uses AppleScript exclusively — returns the real Things task ID.
	 * Throws on failure (no fake IDs).
	 */
	async createTask(item: GitHubItem): Promise<string> {
		const projId = await this.ensureProjectExists();

		const title = this.formatTitle(item);
		const notes = this.formatNotes(item);
		const tags = this.formatTags(item);

		const escapedTitle = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
		const escapedNotes = notes.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

		const script = `
      tell application "Things3"
        set proj to project id "${projId}"
        set newToDo to make new to do with properties {name:"${escapedTitle}", notes:"${escapedNotes}", tag names:"${tags}"} at beginning of proj
        schedule newToDo for current date
        set project of newToDo to proj
        return id of newToDo
      end tell
    `;

		return runAppleScript(script);
	}

	/**
	 * Complete a task in Things via AppleScript.
	 * Uses the real Things ID to set status to completed.
	 */
	async completeTask(thingsId: string): Promise<void> {
		if (thingsId.startsWith("url-")) {
			throw new Error(
				`Cannot complete task with fake ID "${thingsId}". Run "github-things-sync repair" to fix broken mappings.`,
			);
		}

		const escapedId = thingsId.replace(/"/g, '\\"');

		const script = `
      tell application "Things3"
        set t to to do id "${escapedId}"
        set status of t to completed
      end tell
    `;

		runAppleScript(script);
	}

	private formatTitle(item: GitHubItem): string {
		const prefixes: Record<GitHubItemType, string> = {
			"pr-review": "Review",
			"pr-created": "PR",
			"issue-assigned": "Issue",
			"issue-created": "My Issue",
		};

		const prefix = prefixes[item.type];
		const shortRepo = item.repo.split("/").pop() ?? item.repo;
		return `${prefix}: ${item.title} (${shortRepo})`;
	}

	private formatNotes(item: GitHubItem): string {
		return `${item.url}\n\nRepo: ${item.repo}\n#${item.number}`;
	}

	private formatTags(item: GitHubItem): string {
		const baseTags = ["github"];

		if (item.type.startsWith("pr-")) {
			baseTags.push("pr");
		} else {
			baseTags.push("issue");
		}

		if (item.type === "pr-review") {
			baseTags.push("review");
		}

		return baseTags.join(",");
	}

	/**
	 * Find a Things task by matching title.
	 * Used by repair-state to recover real IDs for url- mapped tasks.
	 */
	static findTaskByTitle(searchTitle: string): string | null {
		const escaped = searchTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

		const script = `
      tell application "Things3"
        set matches to (every to do whose name is "${escaped}")
        if (count of matches) > 0 then
          return id of item 1 of matches
        else
          return "NOT_FOUND"
        end if
      end tell
    `;

		try {
			const result = runAppleScript(script);
			return result === "NOT_FOUND" ? null : result;
		} catch {
			return null;
		}
	}
}
