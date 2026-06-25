// ============================================================
// Biu Auto-Optimizer — npm 操作封装
// ============================================================

import { exec } from '../utils/exec.js';
import { debug, warn } from '../utils/logger.js';

/**
 * NpmRunner — npm 操作封装
 *
 * 所有外部调用通过 src/utils/exec.ts 的 exec() 包装
 */
export class NpmRunner {
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * 运行 npm audit
   * @returns 审计结果（vulnerabilities 字典 + summary）
   */
  async audit(): Promise<{
    vulnerabilities: Record<string, unknown>;
    summary: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
      total: number;
    };
  }> {
    debug('[npm] 运行 npm audit --json');

    try {
      const result = await exec('npm', ['audit', '--json'], {
        cwd: this.cwd,
        timeout: 120_000,
      });

      if (!result.stdout) {
        return {
          vulnerabilities: {},
          summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
        };
      }

      const auditOutput = JSON.parse(result.stdout) as {
        vulnerabilities?: Record<string, unknown>;
        metadata?: {
          vulnerabilities?: {
            critical?: number;
            high?: number;
            moderate?: number;
            low?: number;
            info?: number;
            total?: number;
          };
        };
      };

      const v = auditOutput.metadata?.vulnerabilities ?? {};

      return {
        vulnerabilities: auditOutput.vulnerabilities ?? {},
        summary: {
          critical: v.critical ?? 0,
          high: v.high ?? 0,
          moderate: v.moderate ?? 0,
          low: v.low ?? 0,
          info: v.info ?? 0,
          total: v.total ?? 0,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[npm] audit 失败: ${msg}`);
      return {
        vulnerabilities: {},
        summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      };
    }
  }

  /**
   * 运行 npm outdated
   * @returns 过期依赖字典
   */
  async outdated(): Promise<Record<string, unknown>> {
    debug('[npm] 运行 npm outdated --json');

    try {
      const result = await exec('npm', ['outdated', '--json'], {
        cwd: this.cwd,
        timeout: 60_000,
      });

      if (!result.stdout) {
        return {};
      }

      return JSON.parse(result.stdout) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[npm] outdated 失败: ${msg}`);
      return {};
    }
  }

  /**
   * 运行 npm audit fix（仅非破坏性修复）
   * @returns 修复统计
   */
  async auditFix(): Promise<{ fixed: number; remained: number }> {
    debug('[npm] 运行 npm audit fix');

    try {
      const beforeAudit = await this.audit();
      const beforeCount = beforeAudit.summary.total;

      await exec('npm', ['audit', 'fix'], {
        cwd: this.cwd,
        timeout: 120_000,
      });

      const afterAudit = await this.audit();
      const afterCount = afterAudit.summary.total;

      const fixed = Math.max(0, beforeCount - afterCount);
      return { fixed, remained: afterCount };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`[npm] audit fix 失败: ${msg}`);
      return { fixed: 0, remained: 0 };
    }
  }

  /**
   * 更新指定包到最新版本
   * @param packages - 包名列表
   */
  async update(packages: string[]): Promise<void> {
    if (packages.length === 0) return;

    debug(`[npm] 更新包: ${packages.join(', ')}`);

    for (const pkg of packages) {
      try {
        await exec('npm', ['install', `${pkg}@latest`], {
          cwd: this.cwd,
          timeout: 60_000,
        });
        debug(`[npm] ${pkg} 已更新`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`[npm] 更新 ${pkg} 失败: ${msg}`);
      }
    }
  }

  /**
   * 运行 npm install
   */
  async install(): Promise<void> {
    debug('[npm] 运行 npm install');

    await exec('npm', ['install'], {
      cwd: this.cwd,
      timeout: 120_000,
    });
  }
}
