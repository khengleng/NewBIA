const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'investor@cambobia.com' }
    });
    console.log('User:', JSON.stringify(user, null, 2));

    const investor = await prisma.investor.findUnique({
        where: { userId: user.id }
    });
    console.log('Investor Profile:', JSON.stringify(investor, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
