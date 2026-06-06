import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  const fixed = await prisma.$executeRaw`
    UPDATE conversation_members cm
    SET role = 'owner'
    FROM conversations c
    WHERE cm.conversation_id = c.id
    AND cm.user_id = c.owner_id
    AND cm.role = 'member'
  `;
  console.log('Fixed', fixed, 'owner rows');
  await prisma.$disconnect();
}

fix().catch((e) => { console.error(e); process.exit(1); });
