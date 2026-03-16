
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenants = await prisma.tenant.findMany();
    console.log('Tenants:', JSON.stringify(tenants, null, 2));
    const users = await prisma.user.findMany({
        take: 10,
        select: { email: true, tenantId: true }
    });
    console.log('Users:', JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
