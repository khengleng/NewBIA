import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create default tenant
    const tenant = await prisma.tenant.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            name: 'Boutique Advisory',
            domain: 'boutique-advisory.com',
            settings: {},
        },
    });
    console.log('✅ Created tenant:', tenant.name);

    // Hash passwords
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
    console.log(`🔑 Using admin password: ${initialAdminPassword}`);

    const passwordHash = await bcrypt.hash(initialAdminPassword, 10);
    const advisorHash = await bcrypt.hash('advisor123', 10);
    const investorHash = await bcrypt.hash('investor123', 10);
    const smeHash = await bcrypt.hash('sme123', 10);

    // Create Admin user
    const adminUser = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: 'default',
                email: 'contact@cambobia.com'
            }
        },
        update: {},
        create: {
            email: 'contact@cambobia.com',
            password: passwordHash,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            tenantId: 'default',
        },
    });
    console.log('✅ Created admin user:', adminUser.email);

    // Create Advisor user
    const advisorUser = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: 'default',
                email: 'advisor@cambobia.com'
            }
        },
        update: {},
        create: {
            email: 'advisor@cambobia.com',
            password: advisorHash,
            firstName: 'Expert',
            lastName: 'Advisor',
            role: 'ADVISOR',
            tenantId: 'default',
        },
    });
    console.log('✅ Created advisor user:', advisorUser.email);

    // Create Investor user
    const investorUser = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: 'default',
                email: 'investor@cambobia.com'
            }
        },
        update: {},
        create: {
            email: 'investor@cambobia.com',
            password: investorHash,
            firstName: 'John',
            lastName: 'Smith',
            role: 'INVESTOR',
            tenantId: 'default',
        },
    });
    console.log('✅ Created investor user:', investorUser.email);

    // Create SME user
    const smeUser = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: 'default',
                email: 'sme@cambobia.com'
            }
        },
        update: {},
        create: {
            email: 'sme@cambobia.com',
            password: smeHash,
            firstName: 'TechCorp',
            lastName: 'Cambodia',
            role: 'SME',
            tenantId: 'default',
        },
    });
    console.log('✅ Created SME user:', smeUser.email);

    // Create additional investor user for syndicates
    const investor2Hash = await bcrypt.hash('investor2', 10);
    const investor2User = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: 'default',
                email: 'investor2@cambobia.com'
            }
        },
        update: {},
        create: {
            email: 'investor2@cambobia.com',
            password: investor2Hash,
            firstName: 'Sarah',
            lastName: 'Chen',
            role: 'INVESTOR',
            tenantId: 'default',
        },
    });

    // Create SME profile for the SME user (required for migration-manager to detect complete migration)
    const sme = await prisma.sME.upsert({
        where: { id: 'sme_techcorp' },
        update: {},
        create: {
            id: 'sme_techcorp',
            userId: smeUser.id,
            tenantId: 'default',
            name: 'TechCorp Cambodia',
            sector: 'Technology',
            stage: 'GROWTH',
            fundingRequired: 500000,
            description: 'Leading fintech company providing digital payment solutions across Cambodia',
            website: 'https://techcorp.kh',
            location: 'Phnom Penh, Cambodia',
            status: 'CERTIFIED',
        },
    });
    console.log('✅ Created SME:', sme.name);

    // Create second SME user
    const sme2Hash = await bcrypt.hash('sme2', 10);
    const sme2User = await prisma.user.upsert({
        where: {
            tenantId_email: {
                tenantId: 'default',
                email: 'sme2@cambobia.com'
            }
        },
        update: {},
        create: {
            email: 'sme2@cambobia.com',
            password: sme2Hash,
            firstName: 'AgriSmart',
            lastName: 'Cambodia',
            role: 'SME',
            tenantId: 'default',
        },
    });

    // Create second SME
    const sme2 = await prisma.sME.upsert({
        where: { id: 'sme_agrismart' },
        update: {},
        create: {
            id: 'sme_agrismart',
            userId: sme2User.id,
            tenantId: 'default',
            name: 'AgriSmart Cambodia',
            sector: 'Agriculture',
            stage: 'SEED',
            fundingRequired: 250000,
            description: 'IoT-powered smart farming solutions for sustainable agriculture',
            website: 'https://agrismart.kh',
            location: 'Siem Reap, Cambodia',
            status: 'SUBMITTED',
        },
    });
    console.log('✅ Created SME:', sme2.name);

    // Create Investor profile
    const investor = await prisma.investor.upsert({
        where: { id: 'inv_john_smith' },
        update: {},
        create: {
            id: 'inv_john_smith',
            userId: investorUser.id,
            tenantId: 'default',
            name: 'John Smith',
            type: 'ANGEL',
            kycStatus: 'VERIFIED',
            preferences: { sectors: ['Technology', 'Fintech'] },
            portfolio: [],
        },
    });
    console.log('✅ Created Investor:', investor.name);

    // Create second Investor profile
    const investor2 = await prisma.investor.upsert({
        where: { id: 'inv_sarah_chen' },
        update: {},
        create: {
            id: 'inv_sarah_chen',
            userId: investor2User.id,
            tenantId: 'default',
            name: 'Sarah Chen',
            type: 'VENTURE_CAPITAL',
            kycStatus: 'VERIFIED',
            preferences: { sectors: ['Agriculture', 'Technology', 'Sustainability'] },
            portfolio: [],
        },
    });
    console.log('✅ Created Investor:', investor2.name);

    // Create Advisor profile
    const advisor = await prisma.advisor.upsert({
        where: { id: 'adv_expert' },
        update: {},
        create: {
            id: 'adv_expert',
            userId: advisorUser.id,
            tenantId: 'default',
            name: 'Expert Advisor',
            specialization: ['Due Diligence', 'Investment Strategy'],
            certificationList: ['CFA', 'MBA'],
        },
    });
    console.log('✅ Created Advisor:', advisor.name);

    // ============================================
    // CREATE SYNDICATES
    // ============================================
    console.log('\n📊 Creating Syndicates...');

    const syndicate1 = await prisma.syndicate.upsert({
        where: { id: 'synd_cambodia_tech' },
        update: {},
        create: {
            id: 'synd_cambodia_tech',
            tenantId: 'default',
            name: 'Cambodia Tech Fund I',
            description: 'Focused on early-stage tech startups in Cambodia and Southeast Asia',
            leadInvestorId: investor.id,
            targetAmount: 500000,
            minInvestment: 5000,
            maxInvestment: 50000,
            managementFee: 2.0,
            carryFee: 20.0,
            status: 'OPEN',
            closingDate: new Date('2025-03-01'),
        },
    });
    console.log('✅ Created Syndicate:', syndicate1.name);

    const syndicate2 = await prisma.syndicate.upsert({
        where: { id: 'synd_agritech' },
        update: {},
        create: {
            id: 'synd_agritech',
            tenantId: 'default',
            name: 'ASEAN AgriTech Syndicate',
            description: 'Investing in sustainable agriculture technology across ASEAN',
            leadInvestorId: investor2.id,
            targetAmount: 750000,
            minInvestment: 10000,
            maxInvestment: 100000,
            managementFee: 2.5,
            carryFee: 20.0,
            status: 'FORMING',
            closingDate: new Date('2025-04-15'),
        },
    });
    console.log('✅ Created Syndicate:', syndicate2.name);

    // Create a TOKENIZED Syndicate
    const syndicate3 = await prisma.syndicate.upsert({
        where: { id: 'synd_real_estate_token' },
        update: {},
        create: {
            id: 'synd_real_estate_token',
            tenantId: 'default',
            name: 'Prime PP Real Estate Fund',
            description: 'Tokenized real estate fund for prime commercial properties in Phnom Penh.',
            leadInvestorId: investor.id,
            targetAmount: 2000000,
            minInvestment: 500, // Low entry barrier due to tokenization
            maxInvestment: 100000,
            managementFee: 1.5,
            carryFee: 15.0,
            status: 'OPEN',

            // Tokenization Details
            isTokenized: true,
            tokenName: 'Prime Property Token',
            tokenSymbol: 'PPT',
            pricePerToken: 100.0, // 1 Token = $100
            totalTokens: 20000,   // $2M / $100
            tokensSold: 1500,     // Initial sales

            closingDate: new Date('2025-06-30'),
        },
    });
    console.log('✅ Created Tokenized Syndicate:', syndicate3.name);

    // Add investor to tokenized syndicate
    await prisma.syndicateMember.upsert({
        where: {
            syndicateId_investorId: {
                syndicateId: syndicate3.id,
                investorId: investor2.id
            }
        },
        update: {},
        create: {
            syndicateId: syndicate3.id,
            investorId: investor2.id,
            amount: 5000,      // Invested $5,000
            tokens: 50,        // Owns 50 tokens ($5000 / $100)
            status: 'APPROVED',
        },
    });
    console.log('✅ Added member to tokenized syndicate (50 PPT tokens)');

    // Create syndicate members
    await prisma.syndicateMember.upsert({
        where: {
            syndicateId_investorId: {
                syndicateId: syndicate1.id,
                investorId: investor2.id
            }
        },
        update: {},
        create: {
            syndicateId: syndicate1.id,
            investorId: investor2.id,
            amount: 25000,
            status: 'APPROVED',
        },
    });
    console.log('✅ Added member to syndicate');

    // ============================================
    // CREATE DUE DILIGENCE REPORTS
    // ============================================
    console.log('\n📋 Creating Due Diligence Reports...');

    const dd1 = await prisma.dueDiligence.upsert({
        where: { id: 'dd_techcorp' },
        update: {},
        create: {
            id: 'dd_techcorp',
            smeId: sme.id,
            advisorId: advisor.id,
            status: 'COMPLETED',
            financialScore: 85,
            teamScore: 90,
            marketScore: 80,
            productScore: 88,
            legalScore: 75,
            operationalScore: 82,
            overallScore: 84,
            riskLevel: 'LOW',
            strengths: ['Strong tech team', 'Growing market', 'Solid financials'],
            weaknesses: ['Limited regional presence', 'New to market'],
            recommendations: ['Expand to nearby markets', 'Build strategic partnerships'],
            redFlags: [],
            completedAt: new Date(),
            expiresAt: new Date('2025-12-31'),
        },
    });
    console.log('✅ Created Due Diligence for:', sme.name);

    const dd2 = await prisma.dueDiligence.upsert({
        where: { id: 'dd_agrismart' },
        update: {},
        create: {
            id: 'dd_agrismart',
            smeId: sme2.id,
            advisorId: advisor.id,
            status: 'IN_PROGRESS',
            financialScore: 70,
            teamScore: 75,
            marketScore: 85,
            productScore: 80,
            legalScore: 65,
            operationalScore: 70,
            overallScore: 74,
            riskLevel: 'MEDIUM',
            strengths: ['Innovative product', 'Large market opportunity'],
            weaknesses: ['Early stage', 'Limited track record'],
            recommendations: ['Complete legal compliance', 'Strengthen financials'],
            redFlags: [],
        },
    });
    console.log('✅ Created Due Diligence for:', sme2.name);

    // ============================================
    // CREATE COMMUNITY POSTS
    // ============================================
    console.log('\n💬 Creating Community Posts...');

    const post1 = await prisma.communityPost.upsert({
        where: { id: 'post_welcome' },
        update: {},
        create: {
            id: 'post_welcome',
            tenantId: 'default',
            authorId: adminUser.id,
            title: 'Welcome to the Boutique Advisory Community!',
            content: 'We are excited to launch our new community platform. Connect with fellow investors, discover promising SMEs, and share your investment insights. Let\'s build the future of investment advisory together!',
            category: 'ANNOUNCEMENT',
            isPinned: true,
            status: 'PUBLISHED',
            likes: 15,
            views: 120,
        },
    });
    console.log('✅ Created Community Post:', post1.title);

    const post2 = await prisma.communityPost.upsert({
        where: { id: 'post_investment_tips' },
        update: {},
        create: {
            id: 'post_investment_tips',
            tenantId: 'default',
            authorId: investorUser.id,
            title: 'Top 5 Due Diligence Tips for First-Time Angel Investors',
            content: 'After years of investing in early-stage companies, here are my top tips for conducting due diligence:\n\n1. Always meet the founding team in person\n2. Check references from previous employers and investors\n3. Validate market size assumptions independently\n4. Review financials with a qualified accountant\n5. Understand the competitive landscape thoroughly',
            category: 'INVESTOR_INSIGHT',
            isPinned: false,
            status: 'PUBLISHED',
            likes: 28,
            views: 245,
        },
    });
    console.log('✅ Created Community Post:', post2.title);

    const post3 = await prisma.communityPost.upsert({
        where: { id: 'post_techcorp_update' },
        update: {},
        create: {
            id: 'post_techcorp_update',
            tenantId: 'default',
            authorId: smeUser.id,
            smeId: sme.id,
            title: 'TechCorp Cambodia Reaches 100K Active Users!',
            content: 'We are thrilled to announce that TechCorp Cambodia has reached 100,000 active users on our digital payment platform! This milestone represents tremendous growth and validates our mission to bring financial services to underserved communities. Thank you to all our investors and supporters!',
            category: 'SME_NEWS',
            isPinned: false,
            status: 'PUBLISHED',
            likes: 42,
            views: 380,
        },
    });
    console.log('✅ Created Community Post:', post3.title);

    // Create comments
    await prisma.comment.upsert({
        where: { id: 'comment_1' },
        update: {},
        create: {
            id: 'comment_1',
            postId: post2.id,
            authorId: investor2User.id,
            content: 'Great tips! I would add that understanding the TAM/SAM/SOM breakdown is crucial for validating market size.',
            likes: 5,
        },
    });

    await prisma.comment.upsert({
        where: { id: 'comment_2' },
        update: {},
        create: {
            id: 'comment_2',
            postId: post3.id,
            authorId: investorUser.id,
            content: 'Congratulations TechCorp! This is amazing growth. Looking forward to the next milestone! 🎉',
            likes: 8,
        },
    });
    console.log('✅ Created Comments');

    // ============================================
    // CREATE DEALS
    // ============================================
    console.log('\n💰 Creating Deals...');

    const deal1 = await prisma.deal.upsert({
        where: { id: 'deal_techcorp_series_a' },
        update: {},
        create: {
            id: 'deal_techcorp_series_a',
            tenantId: 'default',
            smeId: sme.id,
            title: 'TechCorp Series A',
            description: 'Series A funding to expand operations to 5 new provinces.',
            amount: 1000000,
            equity: 10.0, // 10% equity
            status: 'FUNDED',
            successFee: 5.0,
            terms: 'Standard Series A terms with 1x liquidation preference.',
        },
    });
    console.log('✅ Created Deal:', deal1.title);

    // ============================================
    // CREATE INVESTMENTS (DEAL INVESTORS)
    // ============================================
    console.log('\n🤝 Creating Investments...');

    const investment1 = await prisma.dealInvestor.upsert({
        where: {
            dealId_investorId: {
                dealId: deal1.id,
                investorId: investor.id
            }
        },
        update: {},
        create: {
            dealId: deal1.id,
            investorId: investor.id,
            amount: 50000,
            status: 'COMPLETED',
        },
    });
    console.log('✅ Created Investment for:', investor.name);

    // ============================================
    // CREATE SECONDARY TRADING LISTINGS
    // ============================================
    console.log('\n📈 Creating Secondary Trading Data...');

    const listing1 = await prisma.secondaryListing.upsert({
        where: { id: 'listing_techcorp_1' },
        update: {},
        create: {
            id: 'listing_techcorp_1',
            tenantId: 'default',
            sellerId: investor.id,
            dealInvestorId: investment1.id,
            sharesAvailable: 5000,
            pricePerShare: 12.50,
            minPurchase: 1000,
            status: 'ACTIVE',
        },
    });
    console.log('✅ Created Secondary Listing for:', deal1.title);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`   Admin:     contact@cambobia.com / ${initialAdminPassword}`);
    console.log('   Advisor:   advisor@cambobia.com / advisor123');
    console.log('   Investor:  investor@cambobia.com / investor123');
    console.log('   SME:       sme@cambobia.com / sme123');
    console.log('\n📊 Seeded Data Summary:');
    console.log('   - 2 SMEs');
    console.log('   - 2 Investors');
    console.log('   - 1 Advisor');
    console.log('   - 2 Syndicates');
    console.log('   - 2 Due Diligence Reports');
    console.log('   - 3 Community Posts');
    console.log('   - 2 Comments');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
