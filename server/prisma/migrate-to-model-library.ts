import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始迁移 AiModelConfig → AiModel ...');

  const configs = await prisma.aiModelConfig.findMany();
  console.log(`共找到 ${configs.length} 条 AiModelConfig 记录`);

  let createdModels = 0;
  let skippedConfigs = 0;
  let updatedConfigs = 0;

  for (const config of configs) {
    // 跳过已迁移的记录
    if (config.chatModelId) {
      console.log(`[跳过] config ${config.id} 已有 chatModelId，跳过`);
      skippedConfigs++;
      continue;
    }

    // 检查旧字段是否存在
    if (!config.provider || !config.baseUrl || !config.chatModel) {
      console.log(
        `[跳过] config ${config.id} 缺少必要字段 (provider/baseUrl/chatModel)，跳过`,
      );
      skippedConfigs++;
      continue;
    }

    const maxTokens = config.maxTokens ?? 2000;
    const temperature = config.temperature ?? 0.7;

    // 创建 chatModel 对应的 AiModel
    const chatAiModel = await prisma.aiModel.create({
      data: {
        name: config.chatModel,
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKeyEncrypted: config.apiKeyEncrypted,
        modelName: config.chatModel,
        maxTokens,
        temperature,
      },
    });
    createdModels++;

    // 回填 chatModelId
    const updateData: Record<string, unknown> = {
      chatModelId: chatAiModel.id,
    };

    // 如果 reasoningModel 存在且与 chatModel 不同，再创建一条
    if (config.reasoningModel && config.reasoningModel !== config.chatModel) {
      const reasoningAiModel = await prisma.aiModel.create({
        data: {
          name: config.reasoningModel,
          provider: config.provider,
          baseUrl: config.baseUrl,
          apiKeyEncrypted: config.apiKeyEncrypted,
          modelName: config.reasoningModel,
          maxTokens,
          temperature,
        },
      });
      createdModels++;
      updateData.reasoningModelId = reasoningAiModel.id;
    }

    // arbitrationModelId 保持 null，不处理

    await prisma.aiModelConfig.update({
      where: { id: config.id },
      data: updateData,
    });
    updatedConfigs++;

    console.log(
      `[完成] config ${config.id} → chatModelId=${chatAiModel.id}${updateData.reasoningModelId ? `, reasoningModelId=${updateData.reasoningModelId}` : ''}`,
    );
  }

  console.log('\n迁移结果：');
  console.log(`  创建 AiModel 记录：${createdModels} 条`);
  console.log(`  更新 AiModelConfig 记录：${updatedConfigs} 条`);
  console.log(`  跳过记录：${skippedConfigs} 条`);
}

main()
  .catch((e) => {
    console.error('迁移失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
