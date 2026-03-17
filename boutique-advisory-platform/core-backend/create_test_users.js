
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('investor123', 12);
    const advisorHash = await bcrypt.hash('advisor123', 12);

    // Create Investor
    const investor = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: 'default', email: 'investor@cambobia.com' } },
        update: { isEmailVerified: true, status: 'ACTIVE', password: passwordHash },
        create: {
            email: 'investor@cambobia.com',
            password: passwordHash,
            firstName: 'Test',
            lastName: 'Investor',
            role: 'INVESTOR',
            tenantId: 'default',
            isEmailVerified: true,
            status: 'ACTIVE'
        }
    });

    // Ensure Investor Profile
    await prisma.investor.upsert({
        where: { userId: investor.id },
        update: {},
        create: {
            userId: investor.id,
            tenantId: 'default',
            name: 'Test Investor',
            type: 'ANGEL',
            kycStatus: 'VERIFIED'
        }
    });

    // Create Advisor
    const advisor = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: 'default', email: 'advisor@cambobia.com' } },
        update: { isEmailVerified: true, status: 'ACTIVE', password: advisorHash },
        create: {
            email: 'advisor@cambobia.com',
            password: advisorHash,
            firstName: 'Test',
            lastName: 'Advisor',
            role: 'ADVISOR',
            tenantId: 'default',
            isEmailVerified: true,
            status: 'ACTIVE'
        }
    });

    // Ensure Advisor Profile
    await prisma.advisor.upsert({
        where: { userId: advisor.id },
        update: {},
        create: {
            userId: advisor.id,
            tenantId: 'default',
            name: 'Test Advisor',
            specialization: ['Investment'],
            certificationList: ['CFA'],
            status: 'ACTIVE'
        }
    });

    console.log('Successfully created/updated Investor and Advisor accounts.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
