import { PrismaClient } from '@prisma/client'

// Primary Client (Read/Write)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

// Replica Client (Read Only)
// Falls back to primary if replica URL is not configured
const replicaUrl = process.env.DATABASE_URL_REPLICA || process.env.DATABASE_URL

export const prismaReplica = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: replicaUrl
    }
  }
})

export async function connectDatabase() {
  try {
    // Connect access to primary
    await prisma.$connect()
    console.log('✅ Primary Database connected successfully')

    // Connect access to replica if distinct
    if (process.env.DATABASE_URL_REPLICA) {
      await prismaReplica.$connect()
      console.log('✅ Replica Database connected successfully')
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    // Critical failure if primary cannot connect
    throw error
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect()
    if (process.env.DATABASE_URL_REPLICA) {
      await prismaReplica.$disconnect()
    }
    console.log('✅ Database disconnected successfully')
  } catch (error) {
    console.error('❌ Database disconnection failed:', error)
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectDatabase()
})

process.on('SIGINT', async () => {
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDatabase()
  process.exit(0)
})
