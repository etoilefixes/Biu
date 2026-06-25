// ============================================================
// Biu Auto-Optimizer — `biu-opt changelog` 命令
// ============================================================

import { generate, writeToFile } from '../changelog/generator.js';
import { loadConfig } from '../config/loader.js';
import { info } from '../utils/logger.js';
import { resolve } from 'node:path';

export interface ChangelogOptions {
  from?: string;
  to?: string;
  output?: string;
  format?: string;
  append?: boolean;
}

export async function execute(options: ChangelogOptions): Promise<void> {
  const config = await loadConfig();
  const rootDir = resolve(config.rootDir);

  info('📝 生成 Changelog...');

  const report = await generate(options.from, rootDir);
  const outputPath = options.output ?? resolve(rootDir, 'CHANGELOG.md');
  const append = options.append ?? false;

  await writeToFile(report, outputPath, append);

  info(`✅ Changelog 已生成 (v${report.version}, ${report.entries.length} 条记录)`);
  info(`   输出: ${outputPath}`);
}
