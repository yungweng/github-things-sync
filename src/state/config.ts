/**
 * Configuration management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Config } from '../types/index.js';
import { ALL_SYNC_TYPES } from '../types/index.js';

const DATA_DIR = path.join(os.homedir(), '.github-things-sync');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export function getDataDir(): string {
  return DATA_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadConfig(): Config | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content) as Config;

    // Migration: add syncTypes if missing (for existing configs)
    if (!config.syncTypes) {
      config.syncTypes = [...ALL_SYNC_TYPES];
    }

    return config;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  // Restrict permissions since it contains tokens
  fs.chmodSync(CONFIG_FILE, 0o600);
}
