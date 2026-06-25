# Biu Auto-Optimizer

**Biu 项目自迭代自动化优化工具** — 针对 monorepo 项目的代码审查、安全扫描、依赖管理、性能测试、复杂度分析和自动修复的一站式 CLI 工具。

## 安装

```bash
cd biu-auto-optimizer
npm install
npm run build
```

## 快速开始

```bash
# 运行全量扫描（仅分析，不修改代码）
npx tsx src/cli.ts run --dry-run

# 运行代码审查
npx tsx src/cli.ts lint

# 安全漏洞扫描
npx tsx src/cli.ts security

# 依赖检查
npx tsx src/cli.ts deps:check

# 生成 CHANGELOG
npx tsx src/cli.ts changelog
```

## 命令列表

| 命令 | 说明 | 选项 |
|------|------|------|
| `lint` | ESLint + TypeScript strict 代码审查 | `--fix`, `--format cli\|json\|md` |
| `security` | npm audit + .env 密钥泄漏扫描 | `--format cli\|json\|md` |
| `deps:check` | npm outdated + changelog 分析 | `--format cli\|json\|md` |
| `deps:update` | 自动更新非破坏性依赖 | `--dry-run` |
| `perf` | autocannon 性能基准测试 | `--endpoints url1,url2`, `--format` |
| `changelog` | 生成 CHANGELOG (Conventional Commits) | `--from <tag>`, `--output <path>` |
| `run` | 全量扫描与自动优化 | `--dry-run`, `--analyzers id1,id2` |
| `rollback` | 回滚到指定快照 | `--to <id>`, `--last`, `--list`, `--yes` |
| `dashboard` | 启动 Dashboard Web 看板 | `--port <port>` |
| `nightly` | 夜间自动优化窗口 | `--once`, `--schedule HH:mm` |

## 配置文件

项目根目录的 `.biu-opt.json` 为配置入口：

```json
{
  "rootDir": ".",
  "thresholds": {
    "rollback": 0.05,
    "lintErrors": 0.05,
    "securityCritical": 0,
    "securityHigh": 0,
    "performanceDegradation": 0.05,
    "complexityMax": 15,
    "typeCoverageMin": 0.95,
    "ciBuildTimeIncrease": 0.20
  },
  "analyzers": {
    "code-review": { "enabled": true },
    "security-scan": { "enabled": true },
    "dependency-check": { "enabled": true },
    "performance": { "enabled": true, "options": { "endpoints": ["http://localhost:3000/api/health"] } },
    "n-plus-one": { "enabled": true },
    "complexity": { "enabled": true },
    "lighthouse": { "enabled": false, "options": { "url": "http://localhost:5173" } },
    "type-coverage": { "enabled": true },
    "ci-baseline": { "enabled": false, "options": { "buildScript": "build" } },
    "duplicate-code": { "enabled": true },
    "solid-violations": { "enabled": true },
    "git-knowledge": { "enabled": true },
    "dep-health": { "enabled": true },
    "ui-regression": { "enabled": false },
    "dead-code": { "enabled": true },
    "monorepo-deps": { "enabled": true }
  },
  "autoFix": {
    "enabled": true,
    "createBranch": true,
    "autoMergeLowRisk": false,
    "maxFilesPerFix": 20
  },
  "nightly": {
    "enabled": true,
    "schedule": "02:00",
    "autoCreatePR": false
  },
  "dashboard": {
    "enabled": false,
    "port": 4000
  },
  "reporting": {
    "formats": ["cli", "json"],
    "outputDir": ".biu-opt/reports"
  },
  "workspaces": ["shared", "server", "client"]
}
```

### 分析器列表（共 17 个）

#### P0 — 核心
| ID | 名称 | 类别 | 需求 |
|----|------|------|------|
| `code-review` | ESLint + TS strict | code-quality | R-01 |
| `security-scan` | npm audit + .env 密钥 | security | R-02 |
| `dependency-check` | npm outdated + changelog | dependencies | R-03 |

#### P1 — 进阶
| ID | 名称 | 类别 | 需求 |
|----|------|------|------|
| `performance` | autocannon 基准 | performance | R-06 |
| `n-plus-one` | Prisma N+1 检测 | performance | R-07 |
| `complexity` | 代码复杂度 | complexity | R-08 |
| `lighthouse` | Lighthouse 审计 | performance | R-09 |
| `type-coverage` | TS 类型覆盖率 | type-safety | R-16 |
| `ci-baseline` | CI 构建基线 | performance | R-17 |

#### P2 — 锦上添花
| ID | 名称 | 类别 | 需求 |
|----|------|------|------|
| `duplicate-code` | 重复代码检测 | duplication | R-11 |
| `solid-violations` | SOLID 违规 | code-quality | R-12 |
| `git-knowledge` | Git 知识地图 | code-quality | R-13 |
| `dep-health` | 依赖健康度 | dependencies | R-14 |
| `ui-regression` | UI 回归测试 | performance | R-15 |
| `dead-code` | Dead Code 检测 | code-quality | R-18 |
| `monorepo-deps` | Monorepo 依赖图 | dependencies | R-19 |

### 阈值说明

| 阈值 | 默认 | 说明 |
|------|------|------|
| `rollback` | 0.05 | 通用劣化允许比例 |
| `lintErrors` | 0.05 | Lint 错误数增加允许比例 |
| `securityCritical` | 0 | 严重安全漏洞绝对增量 |
| `securityHigh` | 0 | 高危安全漏洞绝对增量 |
| `performanceDegradation` | 0.05 | P95 延迟劣化允许比例 |
| `complexityMax` | 15 | 最大圈复杂度 |
| `typeCoverageMin` | 0.95 | 最低类型覆盖率 |
| `ciBuildTimeIncrease` | 0.20 | 构建时间增加允许比例 |

## 架构

```
src/
├── analyzers/     # 17 个分析器
│   ├── base.ts            # IAnalyzer + BaseAnalyzer
│   ├── code-review.ts     # R-01
│   ├── security-scan.ts   # R-02
│   ├── dependency-check.ts # R-03
│   ├── performance.ts     # R-06
│   ├── n-plus-one.ts      # R-07
│   ├── complexity.ts      # R-08
│   ├── lighthouse.ts      # R-09
│   ├── duplicate-code.ts  # R-11
│   ├── solid-violations.ts # R-12
│   ├── git-knowledge.ts   # R-13
│   ├── dep-health.ts      # R-14
│   ├── ui-regression.ts   # R-15
│   ├── type-coverage.ts   # R-16
│   ├── ci-baseline.ts     # R-17
│   ├── dead-code.ts       # R-18
│   └── monorepo-deps.ts   # R-19
├── reporters/     # 5 个报告输出器
│   ├── base.ts    # IReporter
│   ├── cli.ts     # 终端表格
│   ├── markdown.ts
│   ├── json.ts
│   └── html.ts    # Chart.js 图表
├── runners/       # 执行器
│   ├── git.ts     # Git 操作
│   ├── npm.ts     # npm 操作
│   └── optimizer.ts # 优化编排
├── snapshots/     # 快照系统
│   ├── store.ts   # 快照读写
│   ├── metrics.ts # 指标采集
│   └── rollback.ts # 回滚决策
├── commands/      # CLI 命令
├── changelog/     # Changelog 生成器
├── config/        # 配置加载
├── dashboard/     # Dashboard 服务
├── types/         # 类型定义
└── utils/         # 工具函数
```

## 工作流程

1. **分析**: 并行运行所有启用的分析器
2. **快照**: 拍前置指标快照（lint errors、安全漏洞、依赖数量等）
3. **修复**: 自动应用非破坏性修复（npm audit fix、依赖更新）
4. **分支**: 创建 `biu-opt/auto-fix-{timestamp}` 分支并提交
5. **对比**: 拍后置快照，对比关键指标
6. **决策**: 超出阈值 → 回滚；否则 → tag + push

## 输出格式

- **CLI**: 带颜色的终端表格（chalk），按 severity 排序
- **JSON**: 结构化 AnalysisReport JSON 文件
- **Markdown**: 按 severity 分组的表格报告
- **HTML**: Chart.js 图表的交互式报告页

## 依赖

- TypeScript, Node >= 18
- ESLint, simple-git, chalk, commander, cosmiconfig, execa, fast-glob, handlebars, semver, zod
- express (Dashboard), node-cron (Nightly)
- autocannon (性能测试，可选), lighthouse (Web 审计，可选)

## License

Private — Biu 项目内部工具
