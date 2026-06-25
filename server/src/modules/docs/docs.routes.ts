import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = Router();

const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');
const OPENAPI_PATH = path.join(PROJECT_ROOT, 'docs', 'api', 'openapi.json');
const SWAGGER_UI_PATH = path.join(__dirname, 'swagger-ui.html');

// ============================================================
// GET /api/docs — Swagger UI
// ============================================================
router.get('/', (_req: Request, res: Response) => {
  res.sendFile(SWAGGER_UI_PATH);
});

// ============================================================
// GET /api/docs/openapi.json — OpenAPI 规范
// ============================================================
router.get('/openapi.json', (_req: Request, res: Response) => {
  if (!fs.existsSync(OPENAPI_PATH)) {
    return res.status(404).json({
      code: 404,
      message: 'API 文档尚未生成，请先调用 POST /api/docs/regenerate',
    });
  }

  const content = fs.readFileSync(OPENAPI_PATH, 'utf-8');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.parse(content));
});

// ============================================================
// POST /api/docs/regenerate — 重新生成文档
// ============================================================
router.post('/regenerate', (_req: Request, res: Response) => {
  const scriptPath = path.join(PROJECT_ROOT, 'tools', 'generate_api_docs.py');

  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({
      code: 500,
      message: '文档生成脚本不存在',
      details: scriptPath,
    });
  }

  // 尝试多个 Python 路径（按优先级，python3 优先于 python）
  const pythonPaths = ['python3', 'python'];

  function tryPython(index: number) {
    if (index >= pythonPaths.length) {
      return res.status(500).json({
        code: 500,
        message: '未找到可用的 Python 运行时',
      });
    }

    const pythonPath = pythonPaths[index];
    exec(
      `"${pythonPath}" "${scriptPath}"`,
      { cwd: PROJECT_ROOT, timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[docs] Python ${pythonPath} failed:`, error.message);
          return tryPython(index + 1);
        }

        console.log('[docs] API 文档生成完成');
        if (stderr) console.error('[docs] stderr:', stderr);

        res.json({
          code: 200,
          message: 'API 文档已重新生成',
          data: {
            output: stdout.trim().split('\n').filter(Boolean),
          },
        });
      }
    );
  }

  tryPython(0);
});

export default router;
