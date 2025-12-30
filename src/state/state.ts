/**
 * Sync state management (task mappings)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { SyncState, TaskMapping } from "../types/index.js";
import { ensureDataDir, getDataDir } from "./config.js";

const STATE_FILE = path.join(getDataDir(), "state.json");

function getDefaultState(): SyncState {
	return {
		mappings: {},
		lastSync: null,
		lastError: null,
	};
}

export function loadState(): SyncState {
	if (!fs.existsSync(STATE_FILE)) {
		return getDefaultState();
	}

	try {
		const content = fs.readFileSync(STATE_FILE, "utf-8");
		return JSON.parse(content) as SyncState;
	} catch {
		return getDefaultState();
	}
}

export function saveState(state: SyncState): void {
	ensureDataDir();
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function addMapping(mapping: TaskMapping): void {
	const state = loadState();
	state.mappings[mapping.githubId] = mapping;
	saveState(state);
}

export function removeMapping(githubId: string): void {
	const state = loadState();
	delete state.mappings[githubId];
	saveState(state);
}

export function getMapping(githubId: string): TaskMapping | null {
	const state = loadState();
	return state.mappings[githubId] ?? null;
}

export function hasMapping(githubId: string): boolean {
	const state = loadState();
	return githubId in state.mappings;
}

export function updateLastSync(): void {
	const state = loadState();
	state.lastSync = new Date().toISOString();
	state.lastError = null;
	saveState(state);
}

export function setLastError(error: string): void {
	const state = loadState();
	state.lastError = error;
	saveState(state);
}
