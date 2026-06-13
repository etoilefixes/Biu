import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { prisma } from '../../config/database';

// GET /ai-roles/models — 获取所有模型
export async function listModels(req: AuthRequest, res: Response) {
  try {
    const models = await prisma.aiModel.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const result = models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      baseUrl: m.baseUrl,
      modelName: m.modelName,
      maxTokens: m.maxTokens,
      temperature: m.temperature,
      hasApiKey: !!m.apiKeyEncrypted,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    res.json({ code: 200, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
}

// POST /ai-roles/models/fetch-remote — 根据 baseUrl + apiKey 获取远程模型列表
export async function fetchRemoteModels(req: AuthRequest, res: Response) {
  try {
    const { baseUrl, apiKey, modelId } = req.body;

    let finalBaseUrl = baseUrl;
    let finalApiKey = apiKey;

    // 如果传了 modelId，从数据库取已存的 baseUrl 和 key
    if (modelId && !finalApiKey) {
      const existing = await prisma.aiModel.findUnique({ where: { id: modelId } });
      if (existing) {
        finalBaseUrl = existing.baseUrl;
        finalApiKey = existing.apiKeyEncrypted;
      }
    }

    if (!finalBaseUrl) {
      res.status(400).json({ code: 400, message: 'baseUrl 为必填项' });
      return;
    }

    const base = finalBaseUrl.replace(/\/+$/, '');
    const url = `${base}/models`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (finalApiKey) {
      headers['Authorization'] = `Bearer ${finalApiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      res.json({ code: 200, data: { success: false, message: `请求失败: HTTP ${response.status} ${text}`, models: [] } });
      return;
    }

    const json = await response.json();
    // OpenAI 兼容格式: { data: [{ id: "model-name", ... }, ...] }
    const rawModels: string[] = (json.data || [])
      .map((m: any) => m.id || m.name || m.model)
      .filter(Boolean);

    // 去重并排序
    const models = [...new Set(rawModels)].sort();

    res.json({ code: 200, data: { success: true, models } });
  } catch (error: any) {
    res.json({ code: 200, data: { success: false, message: `请求失败: ${error.message}`, models: [] } });
  }
}

// POST /ai-roles/models — 新增模型
export async function createModel(req: AuthRequest, res: Response) {
  try {
    const { name, provider, baseUrl, apiKey, modelName, maxTokens, temperature } = req.body;

    if (!name || !provider || !baseUrl || !modelName) {
      res.status(400).json({ code: 400, message: 'name, provider, baseUrl, modelName 为必填项' });
      return;
    }

    const model = await prisma.aiModel.create({
      data: {
        name,
        provider,
        baseUrl,
        apiKeyEncrypted: apiKey || '',
        modelName,
        maxTokens: Math.min(Math.max(maxTokens ?? 2000, 1), 393216),
        temperature: temperature ?? 0.7,
      },
    });

    res.status(201).json({
      code: 201,
      data: {
        id: model.id,
        name: model.name,
        provider: model.provider,
        baseUrl: model.baseUrl,
        modelName: model.modelName,
        maxTokens: model.maxTokens,
        temperature: model.temperature,
        hasApiKey: !!model.apiKeyEncrypted,
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
}

// PUT /ai-roles/models/:id — 更新模型
export async function updateModel(req: AuthRequest, res: Response) {
  try {
    const { id: rawId } = req.params;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { name, provider, baseUrl, apiKey, modelName, maxTokens, temperature } = req.body;

    const existing = await prisma.aiModel.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ code: 404, message: '模型不存在' });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (provider !== undefined) data.provider = provider;
    if (baseUrl !== undefined) data.baseUrl = baseUrl;
    if (modelName !== undefined) data.modelName = modelName;
    if (maxTokens !== undefined) data.maxTokens = Math.min(Math.max(maxTokens, 1), 393216);
    if (temperature !== undefined) data.temperature = temperature;
    // 未传 apiKey 时不覆盖旧 key
    if (apiKey !== undefined) data.apiKeyEncrypted = apiKey;

    const model = await prisma.aiModel.update({
      where: { id },
      data,
    });

    res.json({
      code: 200,
      data: {
        id: model.id,
        name: model.name,
        provider: model.provider,
        baseUrl: model.baseUrl,
        modelName: model.modelName,
        maxTokens: model.maxTokens,
        temperature: model.temperature,
        hasApiKey: !!model.apiKeyEncrypted,
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
}

// DELETE /ai-roles/models/:id — 删除模型
export async function deleteModel(req: AuthRequest, res: Response) {
  try {
    const { id: rawId } = req.params;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    const existing = await prisma.aiModel.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ code: 404, message: '模型不存在' });
      return;
    }

    // 检查是否被 AiModelConfig 引用
    const config = await prisma.aiModelConfig.findFirst({
      where: {
        OR: [
          { chatModelId: id },
          { reasoningModelId: id },
          { arbitrationModelId: id },
        ],
      },
    });

    if (config) {
      res.status(409).json({ code: 409, message: '该模型正在被 AI 模型配置引用，无法删除' });
      return;
    }

    await prisma.aiModel.delete({ where: { id } });
    res.json({ code: 200, message: '模型已删除' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
}

// POST /ai-roles/models/:id/test — 测试模型连接
export async function testModel(req: AuthRequest, res: Response) {
  try {
    const { id: rawId } = req.params;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    const model = await prisma.aiModel.findUnique({ where: { id } });
    if (!model) {
      res.status(404).json({ code: 404, message: '模型不存在' });
      return;
    }

    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/models`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${model.apiKeyEncrypted}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      res.json({ code: 200, data: { success: true, message: '连接成功' } });
    } else {
      const text = await response.text().catch(() => '');
      res.json({ code: 200, data: { success: false, message: `连接失败: HTTP ${response.status} ${text}` } });
    }
  } catch (error: any) {
    res.json({ code: 200, data: { success: false, message: `连接失败: ${error.message}` } });
  }
}
