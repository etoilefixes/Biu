const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({
  select: { id: true, username: true, biuId: true, isSystem: true }
}).then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.$disconnect());
