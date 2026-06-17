-- CreateTable: 新增模型库表
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "base_url" VARCHAR(500) NOT NULL,
    "api_key_encrypted" VARCHAR(500),
    "model_name" VARCHAR(100) NOT NULL,
    "max_tokens" INTEGER NOT NULL DEFAULT 2000,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- AlterTable: AiModelConfig 新增模型引用字段，旧字段改为可空
ALTER TABLE "ai_model_configs" ADD COLUMN "chat_model_id" UUID;
ALTER TABLE "ai_model_configs" ADD COLUMN "reasoning_model_id" UUID;
ALTER TABLE "ai_model_configs" ADD COLUMN "arbitration_model_id" UUID;

-- 旧字段改为可空（迁移阶段保留）
ALTER TABLE "ai_model_configs" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "ai_model_configs" ALTER COLUMN "base_url" DROP NOT NULL;
ALTER TABLE "ai_model_configs" ALTER COLUMN "chat_model" DROP NOT NULL;
ALTER TABLE "ai_model_configs" ALTER COLUMN "max_tokens" DROP NOT NULL;
ALTER TABLE "ai_model_configs" ALTER COLUMN "max_tokens" DROP DEFAULT;
ALTER TABLE "ai_model_configs" ALTER COLUMN "temperature" DROP NOT NULL;
ALTER TABLE "ai_model_configs" ALTER COLUMN "temperature" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_chat_model_id_fkey" FOREIGN KEY ("chat_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_reasoning_model_id_fkey" FOREIGN KEY ("reasoning_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_arbitration_model_id_fkey" FOREIGN KEY ("arbitration_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
