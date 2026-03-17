
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('investor123', 12);
    const advisorHash = await bcrypt.hash('advisor123', 12);

    const tenants = ['default', 'trade'];

    for (const tenantId of tenants) {
        // Create Investor
        const investor = await prisma.user.upsert({
            where: { tenantId_email: { tenantId, email: 'investor@cambobia.com' } },
            update: { isEmailVerified: true, status: 'ACTIVE', password: passwordHash, role: 'INVESTOR' },
            create: {
                email: 'investor@cambobia.com',
                password: passwordHash,
                firstName: 'Test',
                lastName: 'Investor',
                role: 'INVESTOR',
                tenantId,
                isEmailVerified: true,
                status: 'ACTIVE'
            }
        });

        await prisma.investor.upsert({
            where: { userId: investor.id },
            update: {},
            create: {
                userId: investor.id,
                tenantId,
                name: 'Test Investor',
                type: 'ANGEL',
                kycStatus: 'VERIFIED'
            }
        });

        // Create Advisor
        const advisor = await prisma.user.upsert({
            where: { tenantId_email: { tenantId, email: 'advisor@cambobia.com' } },
            update: { isEmailVerified: true, status: 'ACTIVE', password: advisorHash, role: 'ADVISOR' },
            create: {
                email: 'advisor@cambobia.com',
                password: advisorHash,
                firstName: 'Test',
                lastName: 'Advisor',
                role: 'ADVISOR',
                tenantId,
                isEmailVerified: true,
                status: 'ACTIVE'
            }
        });

        await prisma.advisor.upsert({
            where: { userId: advisor.id },
            update: {},
            create: {
                userId: advisor.id,
                tenantId,
                name: 'Test Advisor',
                specialization: ['Investment'],
                certificationList: ['CFA'],
                status: 'ACTIVE'
            }
        });
    }

    console.log('Successfully created/updated Investor and Advisor accounts on both tenants.');
}

main().finally(() => prisma.$disconnect());
