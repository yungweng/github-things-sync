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

  constructor(project: string, authToken: string) {
    this.project = project;
    this.authToken = authToken;
  }

  /**
   * Create a task in Things for a GitHub item
   * Returns the Things task ID
   */
  async createTask(item: GitHubItem): Promise<string> {
    const title = this.formatTitle(item);
    const notes = this.formatNotes(item);
    const tags = this.formatTags(item);

    const params = new URLSearchParams({
      title,
      notes,
      tags,
      when: 'today',
      list: this.project,
      'reveal': 'false',
      // We want the ID back
      'x-success': 'github-things-sync://created',
    });

    const url = `things:///add?${params.toString()}`;

    // Open the URL and capture the x-things-id
    // Unfortunately, Things URL scheme callback is async and complex
    // For MVP, we'll use AppleScript to get more control
    const thingsId = await this.createTaskViaAppleScript(title, notes, tags);

    return thingsId;
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
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedNotes = notes.replace(/"/g, '\\"');

    const script = `
      tell application "Things3"
        set newToDo to make new to do ¬
          with properties {name:"${escapedTitle}", notes:"${escapedNotes}", tag names:"${tags}"}
        set list of newToDo to project "${this.project}"
        set schedule of newToDo to current date
        return id of newToDo
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      return stdout.trim();
    } catch (error) {
      // Fallback: use URL scheme without ID tracking
      console.warn('AppleScript failed, falling back to URL scheme');
      await this.createTaskViaUrlScheme(title, notes, tags);
      // Generate a pseudo-ID based on timestamp
      return `url-${Date.now()}`;
    }
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
