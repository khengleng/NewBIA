import { prisma } from './database'
import bcrypt from 'bcryptjs'

async function migrateData() {
  console.log('🚀 Starting data migration to PostgreSQL...')

  try {
    // Create default tenant
    console.log('📋 Creating default tenant...')
    const defaultTenant = await prisma.tenant.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        name: 'Default Tenant',
        domain: 'boutique-advisory.com',
        settings: {}
      }
    })
    console.log('✅ Default tenant created:', defaultTenant.id)

    // Create test users
    console.log('👥 Creating test users...')
    
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    const users = [
      {
        id: 'admin_1',
        email: 'contact@cambobia.com',
        password: hashedPassword,
        role: 'ADMIN' as const,
        firstName: 'Admin',
        lastName: 'User',
        tenantId: defaultTenant.id
      },
      {
        id: 'advisor_1',
        email: 'advisor@boutique-advisory.com',
        password: hashedPassword,
        role: 'ADVISOR' as const,
        firstName: 'Sarah',
        lastName: 'Johnson',
        tenantId: defaultTenant.id
      },
      {
        id: 'investor_1',
        email: 'investor@boutique-advisory.com',
        password: hashedPassword,
        role: 'INVESTOR' as const,
        firstName: 'John',
        lastName: 'Smith',
        tenantId: defaultTenant.id
      },
      {
        id: 'sme_1',
        email: 'sme@boutique-advisory.com',
        password: hashedPassword,
        role: 'SME' as const,
        firstName: 'Tech',
        lastName: 'Startup',
        tenantId: defaultTenant.id
      }
    ]

    for (const userData of users) {
      await prisma.user.upsert({
        where: { id: userData.id },
        update: userData,
        create: userData
      })
    }
    console.log('✅ Test users created')

    // Create SMEs
    console.log('🏢 Creating SMEs...')
    
    const smes = [
      {
        id: 'sme_1',
        userId: 'sme_1',
        tenantId: defaultTenant.id,
        name: 'Tech Startup A',
        sector: 'Technology',
        stage: 'GROWTH' as const,
        fundingRequired: 500000,
        description: 'Innovative fintech solution for digital payments and financial inclusion.',
        website: 'https://techstartupa.com',
        location: 'Phnom Penh, Cambodia',
        status: 'CERTIFIED' as const
      },
      {
        id: 'sme_2',
        userId: 'advisor_1',
        tenantId: defaultTenant.id,
        name: 'E-commerce Platform B',
        sector: 'E-commerce',
        stage: 'SEED' as const,
        fundingRequired: 200000,
        description: 'Online marketplace connecting local artisans with global customers.',
        website: 'https://ecommerceb.com',
        location: 'Siem Reap, Cambodia',
        status: 'SUBMITTED' as const
      }
    ]

    for (const smeData of smes) {
      await prisma.sME.upsert({
        where: { id: smeData.id },
        update: smeData,
        create: smeData
      })
    }
    console.log('✅ SMEs created')

    // Create Investors
    console.log('💼 Creating investors...')
    
    const investors = [
      {
        id: 'investor_1',
        userId: 'investor_1',
        tenantId: defaultTenant.id,
        name: 'John Smith',
        type: 'ANGEL' as const,
        kycStatus: 'VERIFIED' as const,
        preferences: {},
        portfolio: []
      }
    ]

    for (const investorData of investors) {
      await prisma.investor.upsert({
        where: { id: investorData.id },
        update: investorData,
        create: investorData
      })
    }
    console.log('✅ Investors created')

    // Create Deals
    console.log('🤝 Creating deals...')
    
    const deals = [
      {
        id: 'deal_1',
        tenantId: defaultTenant.id,
        smeId: 'sme_1',
        title: 'Tech Startup A Series A Funding',
        description: 'Series A funding round for Tech Startup A to expand their fintech platform',
        amount: 500000,
        equity: 15,
        status: 'PUBLISHED' as const
      }
    ]

    for (const dealData of deals) {
      await prisma.deal.upsert({
        where: { id: dealData.id },
        update: dealData,
        create: dealData
      })
    }
    console.log('✅ Deals created')

    // Create Deal Investors
    console.log('💰 Creating deal investments...')
    
    const dealInvestors = [
      {
        dealId: 'deal_1',
        investorId: 'investor_1',
        amount: 500000,
        status: 'PENDING' as const
      }
    ]

    for (const dealInvestorData of dealInvestors) {
      await prisma.dealInvestor.upsert({
        where: {
          dealId_investorId: {
            dealId: dealInvestorData.dealId,
            investorId: dealInvestorData.investorId
          }
        },
        update: dealInvestorData,
        create: dealInvestorData
      })
    }
    console.log('✅ Deal investments created')

    // Create Documents
    console.log('📄 Creating documents...')
    
    const documents = [
      {
        id: 'doc_1',
        tenantId: defaultTenant.id,
        name: 'Identification Document',
        type: 'OTHER' as const,
        url: '/uploads/identification.pdf',
        size: 1200000,
        mimeType: 'application/pdf',
        uploadedBy: 'user_1'
      },
      {
        id: 'doc_2',
        tenantId: defaultTenant.id,
        name: 'Proof of Funds',
        type: 'OTHER' as const,
        url: '/uploads/proof-of-funds.pdf',
        size: 2100000,
        mimeType: 'application/pdf',
        uploadedBy: 'user_1'
      },
      {
        id: 'doc_3',
        tenantId: defaultTenant.id,
        name: 'Professional References',
        type: 'OTHER' as const,
        url: '/uploads/references.pdf',
        size: 800000,
        mimeType: 'application/pdf',
        uploadedBy: 'user_1'
      },
      {
        id: 'doc_4',
        tenantId: defaultTenant.id,
        name: 'Term Sheet',
        type: 'LEGAL_DOCUMENT' as const,
        url: '/uploads/term-sheet.pdf',
        size: 1500000,
        mimeType: 'application/pdf',
        dealId: 'deal_1',
        uploadedBy: 'user_1'
      },
      {
        id: 'doc_5',
        tenantId: defaultTenant.id,
        name: 'Financial Model',
        type: 'FINANCIAL_STATEMENT' as const,
        url: '/uploads/financial-model.xlsx',
        size: 2800000,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dealId: 'deal_1',
        uploadedBy: 'user_1'
      },
      {
        id: 'doc_6',
        tenantId: defaultTenant.id,
        name: 'Due Diligence Report',
        type: 'OTHER' as const,
        url: '/uploads/due-diligence.pdf',
        size: 3200000,
        mimeType: 'application/pdf',
        dealId: 'deal_1',
        uploadedBy: 'user_1'
      }
    ]

    for (const documentData of documents) {
      await prisma.document.upsert({
        where: { id: documentData.id },
        update: documentData,
        create: documentData
      })
    }
    console.log('✅ Documents created')

    console.log('🎉 Data migration completed successfully!')
    console.log('📊 Summary:')
    console.log('  - 1 Tenant created')
    console.log('  - 4 Users created')
    console.log('  - 2 SMEs created')
    console.log('  - 1 Investor created')
    console.log('  - 1 Deal created')
    console.log('  - 1 Deal Investment created')
    console.log('  - 6 Documents created')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('✅ Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateData }

