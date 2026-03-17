
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- USERS ---');
    const users = await prisma.user.findMany();
    console.table(users.map(u => ({ id: u.id, email: u.email, role: u.role, tenantId: u.tenantId })));

    console.log('\n--- SMEs ---');
    const smes = await prisma.sME.findMany();
    console.table(smes.map(s => ({ id: s.id, userId: s.userId, name: s.name, tenantId: s.tenantId })));

    console.log('\n--- DEALS ---');
    const deals = await prisma.deal.findMany();
    console.table(deals.map(d => ({ id: d.id, title: d.title, smeId: d.smeId, status: d.status, tenantId: d.tenantId })));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
