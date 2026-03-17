
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sme = await prisma.sME.findFirst({
        where: { user: { email: 'myerpkh@gmail.com' } },
    });
    console.log('SME Status:', sme);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
