
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { in: ['investor@cambobia.com', 'advisor@cambobia.com', 'contact@cambobia.com'] } },
        select: { email: true, tenantId: true, role: true, isEmailVerified: true, status: true }
    });
    console.log(JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
