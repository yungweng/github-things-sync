/**
 * Things 3 client using URL Scheme
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitHubItem, GitHubItemType } from '../types/index.js';

const execAsync = promisify(exec);

export class ThingsClient {
  private project: string;
  private authToken: string;
  private projectVerified: boolean = false;

  constructor(project: string, authToken: string) {
    this.project = project;
    this.authToken = authToken;
  }

  /**
   * Ensure the project exists in Things, create if not
   */
  async ensureProjectExists(): Promise<void> {
    if (this.projectVerified) return;

    const script = `
      tell application "Things3"
        try
          set proj to project "${this.project}"
          return "exists"
        on error
          make new project with properties {name:"${this.project}"}
          return "created"
        end try
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      const result = stdout.trim();
      if (result === 'created') {
        console.log(`📁 Created Things project: ${this.project}`);
      }
      this.projectVerified = true;
    } catch (error) {
      console.warn(`Warning: Could not verify/create project: ${error}`);
    }
  }

  /**
   * Create a task in Things for a GitHub item
   * Returns the Things task ID
   */
  async createTask(item: GitHubItem): Promise<string> {
    // Ensure project exists before creating task
    await this.ensureProjectExists();

    const title = this.formatTitle(item);
    const notes = this.formatNotes(item);
    const tags = this.formatTags(item);

    // Try AppleScript first (gives us the ID back)
    try {
      const thingsId = await this.createTaskViaAppleScript(title, notes, tags);
      return thingsId;
    } catch (error) {
      // Fallback: use URL scheme (more reliable but no ID)
      console.warn('AppleScript failed, falling back to URL scheme');
      await this.createTaskViaUrlScheme(title, notes, tags);
      return `url-${Date.now()}`;
    }
  }

  /**
   * Complete a task in Things
   */
  async completeTask(thingsId: string): Promise<void> {
    const params = new URLSearchParams({
      id: thingsId,
      'auth-token': this.authToken,
      completed: 'true',
    });

    const url = `things:///update?${params.toString()}`;
    await execAsync(`open "${url}"`);
  }

  /**
   * Create task via AppleScript (more reliable for getting ID)
   */
  private async createTaskViaAppleScript(
    title: string,
    notes: string,
    tags: string
  ): Promise<string> {
    // Escape special characters for AppleScript
    const escapedTitle = title.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    const escapedNotes = notes.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    const escapedProject = this.project.replace(/"/g, '\\"');

    // Create task directly in the project using "at beginning of"
    const script = `
      tell application "Things3"
        set proj to project "${escapedProject}"
        set newToDo to make new to do with properties {name:"${escapedTitle}", notes:"${escapedNotes}", tag names:"${tags}"} at beginning of proj
        return id of newToDo
      end tell
    `;

    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
    const rawId = stdout.trim();
    // AppleScript returns "to do id XYZ", extract just the ID
    const match = rawId.match(/to do id (.+)/);
    return match ? match[1] : rawId;
  }

  /**
   * Fallback: create via URL scheme
   */
  private async createTaskViaUrlScheme(
    title: string,
    notes: string,
    tags: string
  ): Promise<void> {
    const params = new URLSearchParams({
      title,
      notes,
      tags,
      when: 'today',
      list: this.project,
    });

    const url = `things:///add?${params.toString()}`;
    await execAsync(`open "${url}"`);
  }

  private formatTitle(item: GitHubItem): string {
    const prefixes: Record<GitHubItemType, string> = {
      'pr-review': 'Review',
      'pr-created': 'PR',
      'issue-assigned': 'Issue',
      'issue-created': 'My Issue',
    };

    const prefix = prefixes[item.type];
    // Include repo name for context
    const shortRepo = item.repo.split('/').pop() ?? item.repo;
    return `${prefix}: ${item.title} (${shortRepo})`;
  }

  private formatNotes(item: GitHubItem): string {
    return `${item.url}\n\nRepo: ${item.repo}\n#${item.number}`;
  }

  private formatTags(item: GitHubItem): string {
    const baseTags = ['github'];

    if (item.type.startsWith('pr-')) {
      baseTags.push('pr');
    } else {
      baseTags.push('issue');
    }

    if (item.type === 'pr-review') {
      baseTags.push('review');
    }

    return baseTags.join(',');
  }
}
