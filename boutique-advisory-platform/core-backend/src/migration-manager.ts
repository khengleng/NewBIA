import { prisma } from './database'
import bcrypt from 'bcryptjs'

// Migration status - ALWAYS USE DATABASE (no in-memory fallback)
let migrationCompleted = true
let useDatabase = true

export interface MigrationStatus {
  completed: boolean
  useDatabase: boolean
  error?: string
}

// Function to check if migration is needed and safe to proceed
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  try {
    // Check if database is accessible
    await prisma.$connect()

    // Check if data exists in database
    const userCount = await prisma.user.count()
    const smeCount = await prisma.sME.count()
    const investorCount = await prisma.investor.count()
    const dealCount = await prisma.deal.count()

    // If we have data in database, migration is complete
    if (userCount > 0 && smeCount > 0) {
      migrationCompleted = true
      useDatabase = true
      console.log('✅ Database migration already completed')
      return { completed: true, useDatabase: true }
    }

    // If no data in database, we need to migrate
    console.log('📋 Database is empty, migration needed')
    return { completed: false, useDatabase: false }

  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return {
      completed: false,
      useDatabase: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Function to perform the migration
export async function performMigration(): Promise<MigrationStatus> {
  try {
    console.log('🚀 Starting data migration to PostgreSQL...')

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

    // SECURITY: Use environment variable for initial admin password, or generate secure random
    let initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialPassword || initialPassword.length < 12) {
      console.warn('⚠️ SECURITY WARNING: INITIAL_ADMIN_PASSWORD environment variable is missing or too short (< 12 chars).');
      console.warn('⚠️ Generating a secure random password for initial setup to prevent crash.');
      initialPassword = require('crypto').randomBytes(16).toString('hex');
      console.log('🔐 Auto-generated initial admin password in memory (not logged).');
      console.log('   IMPORTANT: Set INITIAL_ADMIN_PASSWORD explicitly and rotate credentials after bootstrap.');
    }

    const hashedPassword = await bcrypt.hash(initialPassword as string, 12)
    console.log('✅ Using securely configured initial password')

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
        uploadedBy: 'admin_1'
      },
      {
        id: 'doc_2',
        tenantId: defaultTenant.id,
        name: 'Proof of Funds',
        type: 'OTHER' as const,
        url: '/uploads/proof-of-funds.pdf',
        size: 2100000,
        mimeType: 'application/pdf',
        uploadedBy: 'admin_1'
      },
      {
        id: 'doc_3',
        tenantId: defaultTenant.id,
        name: 'Professional References',
        type: 'OTHER' as const,
        url: '/uploads/references.pdf',
        size: 800000,
        mimeType: 'application/pdf',
        uploadedBy: 'admin_1'
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
        uploadedBy: 'admin_1'
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
        uploadedBy: 'admin_1'
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
        uploadedBy: 'admin_1'
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

    // Mark migration as complete
    migrationCompleted = true
    useDatabase = true

    console.log('🎉 Data migration completed successfully!')
    console.log('📊 Summary:')
    console.log('  - 1 Tenant created')
    console.log('  - 4 Users created')
    console.log('  - 2 SMEs created')
    console.log('  - 1 Investor created')
    console.log('  - 1 Deal created')
    console.log('  - 1 Deal Investment created')
    console.log('  - 6 Documents created')

    return { completed: true, useDatabase: true }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    migrationCompleted = false
    useDatabase = false
    return {
      completed: false,
      useDatabase: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Function to get current migration status
export function getMigrationStatus(): MigrationStatus {
  return {
    completed: migrationCompleted,
    useDatabase: useDatabase
  }
}

// Function to switch to database mode (after successful migration)
export function switchToDatabase() {
  if (migrationCompleted) {
    useDatabase = true
    console.log('✅ Switched to database mode')
    return true
  }
  console.log('❌ Cannot switch to database mode - migration not completed')
  return false
}

// Function to fallback to in-memory mode
export function fallbackToInMemory() {
  useDatabase = false
  console.log('⚠️  Fallback to in-memory mode')
  return true
}

// Function to check if we should use database
// ALWAYS RETURNS TRUE - No in-memory fallback
export function shouldUseDatabase(): boolean {
  return true  // Always use database for data persistence
}
