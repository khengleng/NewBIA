const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { email: 'investor@cambobia.com' }
        });

        if (!user) {
            console.log('No user');
            return;
        }

        const userId = user.id;
        const userRole = user.role;
        const tenantId = user.tenantId || 'default';

        let investor = await prisma.investor.findUnique({
            where: { userId }
        });

        if (!investor) {
            console.log('Investor profile not found for user:', userId);
            return;
        }

        const [dealInvestments, syndicateInvestments, launchpadCommitments] = await Promise.all([
            prisma.dealInvestor.findMany({
                where: {
                    investorId: investor.id,
                    status: { in: ['COMPLETED', 'APPROVED'] }
                },
                include: {
                    deal: {
                        include: {
                            sme: true
                        }
                    }
                }
            }),
            prisma.syndicateMember.findMany({
                where: {
                    investorId: investor.id,
                    status: 'APPROVED'
                },
                include: {
                    syndicate: {
                        include: {
                            deal: {
                                include: {
                                    sme: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.launchpadCommitment.findMany({
                where: {
                    investorId: investor.id
                },
                include: {
                    offering: {
                        include: {
                            deal: { include: { sme: true } }
                        }
                    }
                }
            })
        ]);

        if (dealInvestments.length === 0 && syndicateInvestments.length === 0 && launchpadCommitments.length === 0) {
            console.log("No investments");
        }

        // 2. Calculate Portfolio Metrics
        const dealAum = dealInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const syndicateAum = syndicateInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const launchpadAum = launchpadCommitments.reduce((sum, inv) => sum + (inv.committedAmount || 0), 0);
        const totalAum = dealAum + syndicateAum + launchpadAum;
        const activePositions = dealInvestments.length + syndicateInvestments.length + launchpadCommitments.length;

        // Find the earliest investment date
        const allInvestments = [
            ...dealInvestments.map(i => ({ date: i.createdAt, amount: i.amount, sector: i.deal?.sme?.sector })),
            ...syndicateInvestments.map(i => ({ date: i.joinedAt, amount: i.amount, sector: i.syndicate?.deal?.sme?.sector || 'Syndicate' })),
            ...launchpadCommitments.map(i => ({ date: i.createdAt, amount: i.committedAmount, sector: i.offering?.deal?.sme?.sector || 'Launchpad' }))
        ];

        const startDate = allInvestments.reduce((earliest, inv) => {
            return inv.date < earliest ? inv.date : earliest;
        }, new Date());

        console.log('Success!', totalAum, activePositions);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
