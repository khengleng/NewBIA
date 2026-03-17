
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sme = await prisma.sME.findFirst({
        where: { user: { email: 'myerpkh@gmail.com' } },
    });

    if (!sme) {
        console.log('SME not found');
        return;
    }

    const deal = await prisma.deal.create({
        data: {
            tenantId: sme.tenantId,
            smeId: sme.id,
            title: 'Growth Capital for SME Owner',
            description: 'Investment opportunity referenced by user.',
            amount: 500000,
            equity: 10,
            status: 'DRAFT', // Restoring as draft
        },
    });

    console.log('Created deal:', deal);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
