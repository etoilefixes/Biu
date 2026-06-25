// ============================================================
// 测试: 工具函数 (logger, fs, exec)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ============================================================
// Logger 测试
// ============================================================
describe('logger — 日志输出', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('T14: info() 应写入 stdout 并包含 [INFO] 标记', async () => {
    // 使用动态导入确保每次 mock 生效
    const { info } = await import('../src/utils/logger.js');
    info('测试消息');

    const calls = stdoutSpy.mock.calls;
    const output = calls.map((c) => c[0]).join('');
    expect(output).toContain('[INFO]');
    expect(output).toContain('测试消息');
  });

  it('T15: error() 应写入 stderr 并包含 [ERROR] 标记', async () => {
    const { error } = await import('../src/utils/logger.js');
    error('错误消息');

    const calls = stderrSpy.mock.calls;
    const output = calls.map((c) => c[0]).join('');
    expect(output).toContain('[ERROR]');
    expect(output).toContain('错误消息');
  });

  it('T16: warn() 应写入 stderr 并包含 [WARN] 标记', async () => {
    const { warn } = await import('../src/utils/logger.js');
    warn('警告消息');

    const calls = stderrSpy.mock.calls;
    const output = calls.map((c) => c[0]).join('');
    expect(output).toContain('[WARN]');
    expect(output).toContain('警告消息');
  });

  it('T17: debug() 在非 verbose 模式下不应输出', async () => {
    // 确保环境变量未设置
    delete process.env.BIU_OPT_VERBOSE;
    delete process.env.BIU_OPT_DEBUG;

    // 由于模块已被缓存，需要清除缓存重新导入
    vi.resetModules();
    const { debug } = await import('../src/utils/logger.js');
    debug('调试消息');

    const stdoutCalls = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    const stderrCalls = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stdoutCalls + stderrCalls).not.toContain('调试消息');
  });

  it('T18: debug() 在 BIU_OPT_VERBOSE=1 时应输出', async () => {
    process.env.BIU_OPT_VERBOSE = '1';

    vi.resetModules();
    const { debug } = await import('../src/utils/logger.js');
    debug('调试消息');

    const calls = stdoutSpy.mock.calls;
    const output = calls.map((c) => c[0]).join('');
    expect(output).toContain('[DEBUG]');
    expect(output).toContain('调试消息');

    delete process.env.BIU_OPT_VERBOSE;
  });

  it('T19: 日志应包含 [HH:mm:ss] 时间戳格式', async () => {
    vi.resetModules();
    const { info } = await import('../src/utils/logger.js');
    info('时间戳测试');

    const calls = stdoutSpy.mock.calls;
    const output = calls.map((c) => c[0]).join('');
    // 验证格式: [HH:mm:ss]
    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
  });
});

// ============================================================
// FS 工具测试
// ============================================================
describe('fs — 文件系统工具', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), 'biu-opt-test-' + randomUUID());
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('T20: safeMkdir 应递归创建目录', async () => {
    const { safeMkdir } = await import('../src/utils/fs.js');
    const deepDir = resolve(testDir, 'a/b/c/d');
    await safeMkdir(deepDir);

    // 应不抛异常，且目录应存在
    const { access } = await import('node:fs/promises');
    await expect(access(deepDir)).resolves.toBeUndefined();
  });

  it('T21: ensureDir 对已存在的目录应不报错', async () => {
    const { ensureDir } = await import('../src/utils/fs.js');
    // 第一次创建
    await ensureDir(testDir);
    // 第二次不应报错（目录已存在）
    await expect(ensureDir(testDir)).resolves.toBeUndefined();
  });

  it('T22: writeJSON → readJSON 应形成闭环', async () => {
    const { writeJSON, readJSON } = await import('../src/utils/fs.js');
    const filePath = resolve(testDir, 'test.json');
    const data = { name: 'biu', version: 1, nested: { key: 'value' } };

    await writeJSON(filePath, data);
    const loaded = await readJSON<typeof data>(filePath);

    expect(loaded).toEqual(data);
  });

  it('T23: writeJSON 应自动创建父目录', async () => {
    const { writeJSON, readJSON } = await import('../src/utils/fs.js');
    const filePath = resolve(testDir, 'nested/deep/test.json');
    const data = { created: true };

    await writeJSON(filePath, data);
    const loaded = await readJSON<typeof data>(filePath);

    expect(loaded).toEqual(data);
  });

  it('T24: readJSON 对不存在的文件应抛出错误', async () => {
    const { readJSON } = await import('../src/utils/fs.js');
    const filePath = resolve(testDir, 'does-not-exist.json');

    await expect(readJSON(filePath)).rejects.toThrow('文件不存在');
  });

  it('T25: readJSON 对无效 JSON 应抛出错误', async () => {
    const { readJSON } = await import('../src/utils/fs.js');
    const filePath = resolve(testDir, 'invalid.json');
    await writeFile(filePath, 'not valid json{', 'utf-8');

    await expect(readJSON(filePath)).rejects.toThrow('JSON 解析失败');
  });

  it('T26: writeJSON 的 pretty=false 应输出压缩 JSON', async () => {
    const { writeJSON } = await import('../src/utils/fs.js');
    const { readFile } = await import('node:fs/promises');
    const filePath = resolve(testDir, 'compact.json');
    const data = { a: 1, b: 2 };

    await writeJSON(filePath, data, false);
    const content = await readFile(filePath, 'utf-8');

    // 压缩版本不应包含换行
    expect(content).not.toContain('\n');
    expect(JSON.parse(content)).toEqual(data);
  });

  it('T27: writeJSON 的 pretty=true 应输出格式化 JSON', async () => {
    const { writeJSON } = await import('../src/utils/fs.js');
    const { readFile } = await import('node:fs/promises');
    const filePath = resolve(testDir, 'pretty.json');
    const data = { a: 1, b: 2 };

    await writeJSON(filePath, data, true);
    const content = await readFile(filePath, 'utf-8');

    // 格式化版本应包含换行和缩进
    expect(content).toContain('\n');
    expect(content).toContain('  ');
    expect(JSON.parse(content)).toEqual(data);
  });
});

// ============================================================
// Exec 工具测试
// ============================================================
describe('exec — execa 包装', () => {
  it('T28: 执行成功的命令应返回 stdout 和 exitCode=0', async () => {
    const { exec } = await import('../src/utils/exec.js');

    const result = await exec('node', ['-e', 'console.log("hello")']);

    expect(result.stdout).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  it('T29: 命令非零退出码不应抛异常 (reject: false)', async () => {
    const { exec } = await import('../src/utils/exec.js');

    const result = await exec('node', ['-e', 'process.exit(1)']);

    expect(result.exitCode).toBe(1);
  });

  it('T30: 命令不存在应返回非零 exitCode (reject: false 模式)', async () => {
    const { exec } = await import('../src/utils/exec.js');

    const result = await exec('non_existent_command_xyz_123', []);

    // 在 Windows 上，execa 的 reject:false 模式下不存在的命令也返回结果
    // exitCode 应为非零或 stderr 非空表示命令失败
    expect(result.exitCode === 0 ? result.stderr.length : true).toBeTruthy();
  });

  it('T31: 返回的 stderr 应为字符串', async () => {
    const { exec } = await import('../src/utils/exec.js');

    const result = await exec('node', ['-e', 'console.error("err msg")']);

    expect(result.stderr).toBe('err msg');
    expect(typeof result.stderr).toBe('string');
  });
});
