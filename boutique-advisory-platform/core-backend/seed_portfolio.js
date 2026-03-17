
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const investorUser = await prisma.user.findFirst({
        where: { email: 'investor@cambobia.com', tenantId: 'default' }
    });

    if (!investorUser) {
        console.log('Investor user not found.');
        return;
    }

    const investorProfile = await prisma.investor.findUnique({
        where: { userId: investorUser.id }
    });

    if (!investorProfile) {
        console.log('Investor profile not found.');
        return;
    }

    // Get a few deals to invest in
    const deals = await prisma.deal.findMany({
        where: { tenantId: 'default' },
        take: 3
    });

    if (deals.length === 0) {
        console.log('No active deals found to seed investments.');
        return;
    }

    for (let i = 0; i < deals.length; i++) {
        await prisma.dealInvestor.upsert({
            where: {
                dealId_investorId: {
                    dealId: deals[i].id,
                    investorId: investorProfile.id
                }
            },
            update: {
                amount: 5000 * (i + 1),
                status: 'COMPLETED'
            },
            create: {
                investorId: investorProfile.id,
                dealId: deals[i].id,
                amount: 5000 * (i + 1),
                status: 'COMPLETED'
            }
        });
    }

    console.log('Successfully seeded investments for investor@cambobia.com');
}

main().finally(() => prisma.$disconnect());
