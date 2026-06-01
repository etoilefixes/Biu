const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.userBadge.findMany({
  where: { userId: '2daa7a30-f46a-4fd7-b1b8-a34b2706106d' },
  include: { badge: true }
}).then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.$disconnect());
