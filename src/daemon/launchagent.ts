/**
 * LaunchAgent management for macOS autostart
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const PLIST_NAME = "com.github-things-sync.plist";
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, PLIST_NAME);

export function installLaunchAgent(): void {
	// Ensure LaunchAgents directory exists
	if (!fs.existsSync(LAUNCH_AGENTS_DIR)) {
		fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
	}

	// Find the installed binary path
	// This assumes global npm install puts it in a standard location
	let binPath: string;
	try {
		binPath = execSync("which github-things-sync", {
			encoding: "utf-8",
		}).trim();
	} catch {
		// Fallback: assume it's in npm global bin
		const npmPrefix = execSync("npm prefix -g", { encoding: "utf-8" }).trim();
		binPath = path.join(npmPrefix, "bin", "github-things-sync");
	}

	const logPath = path.join(os.homedir(), ".github-things-sync", "daemon.log");

	const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.github-things-sync</string>

    <key>ProgramArguments</key>
    <array>
        <string>${binPath}</string>
        <string>start</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>${logPath}</string>

    <key>StandardErrorPath</key>
    <string>${logPath}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
`;

	fs.writeFileSync(PLIST_PATH, plist);

	// Load the agent
	try {
		execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null || true`);
		execSync(`launchctl load "${PLIST_PATH}"`);
	} catch (error) {
		console.warn(`Warning: Could not load LaunchAgent: ${error}`);
		console.warn("You may need to manually load it or restart your Mac.");
	}
}

export function uninstallLaunchAgent(): void {
	if (!fs.existsSync(PLIST_PATH)) {
		return;
	}

	try {
		execSync(`launchctl unload "${PLIST_PATH}"`);
	} catch {
		// Ignore if not loaded
	}

	fs.unlinkSync(PLIST_PATH);
}

export function isLaunchAgentInstalled(): boolean {
	return fs.existsSync(PLIST_PATH);
}
