-- DropForeignKey: 先删除旧字段上的外键（如果有的话，实际旧字段无外键）
-- 删除 AiModelConfig 中的旧字段（迁移阶段已结束，新模型引用字段已就绪）

ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "base_url";
ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "api_key_encrypted";
ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "chat_model";
ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "reasoning_model";
ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "max_tokens";
ALTER TABLE "ai_model_configs" DROP COLUMN IF EXISTS "temperature";
