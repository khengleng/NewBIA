#!/usr/bin/env node

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting bulk 2FA disable...');

  const usersWith2fa = await prisma.user.findMany({
    where: { twoFactorEnabled: true },
    select: { id: true, email: true },
  });

  const userIds = usersWith2fa.map((u) => u.id);
  const beforeCount = userIds.length;

  console.log(`Users with 2FA enabled: ${beforeCount}`);

  if (beforeCount === 0) {
    console.log('No users to update. Exiting.');
    return;
  }

  const [updatedUsers, deletedTokens] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    }),
    prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    }),
  ]);

  const afterCount = await prisma.user.count({
    where: { twoFactorEnabled: true },
  });

  console.log(`Updated users: ${updatedUsers.count}`);
  console.log(`Deleted refresh tokens: ${deletedTokens.count}`);
  console.log(`Users with 2FA still enabled: ${afterCount}`);
  console.log('Bulk 2FA disable completed.');
}

main()
  .catch((error) => {
    console.error('Bulk 2FA disable failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
