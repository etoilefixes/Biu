# 模型库与仲裁模型独立配置

## 背景

当前所有模型配置（provider、baseUrl、apiKey、chatModel、reasoningModel）挤在 `AiModelConfig` 单条记录中，LLM 仲裁直接复用 chatModel，无法为不同用途指定不同模型/服务商。

## 目标

1. 引入"模型库"概念，每条模型记录独立保存完整连接信息
2. 聊天、推理、仲裁三种用途分别引用模型库中的记录
3. 自动迁移旧配置，保留兼容兜底

## 数据模型

### 新增 AiModel 表（模型库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VarChar(100) | 别名，如"DeepSeek V4 Flash" |
| provider | VarChar(50) | 服务商：deepseek / openai-compatible / qwen / ollama |
| baseUrl | VarChar(500) | API 地址 |
| apiKeyEncrypted | VarChar(500)? | API Key |
| modelName | VarChar(100) | 模型标识，如 deepseek-v4-flash |
| maxTokens | Int, default 2000 | 模型级默认 max_tokens |
| temperature | Float, default 0.7 | 模型级默认 temperature |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### 改造 AiModelConfig 表

移除字段：`provider`, `baseUrl`, `apiKeyEncrypted`, `chatModel`, `reasoningModel`, `maxTokens`, `temperature`

新增字段：
- `chatModelId` → AiModel.id（聊天模型引用）
- `reasoningModelId` → AiModel.id?（推理模型引用，可空）
- `arbitrationModelId` → AiModel.id?（仲裁模型引用，可空，空则回退 chatModelId）

保留字段：`reasoningEnabled`, `reasoningMode`, `reasoningDisplay`, `reasoningEffort`, `streamingEnabled`, `contextMessageLimit`, `includePrivateContext`, `aiTriggerMode`

## 实施步骤

### 1. 新增 AiModel 模型库表
- Prisma schema 新增 AiModel model
- 生成 migration

### 2. 改造 AiModelConfig 表结构
- 新增 chatModelId / reasoningModelId / arbitrationModelId 字段
- 暂保留旧字段（迁移完成后再删）

### 3. 自动迁移旧配置
- 迁移脚本：将现有 AiModelConfig 的 provider/baseUrl/apiKey/chatModel/maxTokens/temperature 组合为 AiModel 记录
- 如果 reasoningModel 与 chatModel 不同，再创建一条 AiModel 记录
- 回填 chatModelId / reasoningModelId
- arbitrationModelId 留空（兜底到 chatModelId）

### 4. 改造 LLM 调用链
- `getGlobalConfig()` 改为按用途解析 AiModel
- `streamLLMAndReply` / `callLLM` / `llmArbitration` 接收 AiModel 记录而非全局配置中的字段
- 仲裁调用使用 arbitrationModelId 对应的模型，空则回退 chatModelId

### 5. 改造设置 UI/API
- 新增模型库 CRUD API：`GET/POST/PUT/DELETE /ai-roles/models`
- 新增模型库管理 UI：添加/编辑/删除/测试模型
- AiSettingsPanel 改为下拉选择模型（从模型库中选），不再手动输入模型名
- 测试连接改为针对单个模型测试

### 6. 保留兼容兜底
- arbitrationModelId 为空时回退到 chatModelId
- getGlobalConfig 中如果 AiModelConfig 无 chatModelId（未迁移），fallback 到环境变量

## API 设计

### 模型库 CRUD

- `GET /ai-roles/models` — 获取所有模型（不返回 apiKey）
- `POST /ai-roles/models` — 新增模型
- `PUT /ai-roles/models/:id` — 更新模型
- `DELETE /ai-roles/models/:id` — 删除模型（检查是否被引用）
- `POST /ai-roles/models/:id/test` — 测试单个模型连接

### 全局配置（改造）

- `GET /ai-roles/config/model` — 返回配置 + 关联模型详情
- `PUT /ai-roles/config/model` — 保存配置（chatModelId / reasoningModelId / arbitrationModelId）
