/**
 * sync command - Run a single sync (no daemon)
 */

import { loadConfig } from '../../state/config.js';
import { runSync } from '../../daemon/sync.js';

interface SyncOptions {
  verbose?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('❌ Not configured. Run `github-things-sync init` first.');
    process.exit(1);
  }

  console.log('🔄 Syncing...\n');

  try {
    const result = await runSync(config, options.verbose ?? false);

    console.log('\n✅ Sync complete');
    console.log(`   Created: ${result.created} tasks`);
    console.log(`   Completed: ${result.completed} tasks`);
    console.log(`   Unchanged: ${result.unchanged} tasks`);

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((err) => console.log(`     • ${err}`));
    }
  } catch (error) {
    console.error(`❌ Sync failed: ${error}`);
    process.exit(1);
  }
}
