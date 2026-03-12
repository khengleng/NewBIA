export interface User {
    id: string
    firstName: string
    lastName: string
    email: string
    role: 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'FINOPS' | 'CX' | 'AUDITOR' | 'COMPLIANCE' | 'SUPPORT'
    tenantId: string
    token?: string
}

export interface SME {
    id: string
    name: string
    sector: string
    stage: string
    fundingRequired: number
    location: string
    status?: string
    description: string
    website?: string
    score?: number
    certified?: boolean
    industry?: string
    employeeCount?: number
    annualRevenue?: number
    currentAssets?: number
    currentLiabilities?: number
    totalRevenue?: number
    netProfit?: number
    valueProposition?: string
    targetMarket?: string
    competitiveAdvantage?: string
}

export interface Investor {
    id: string
    userId?: string
    name: string
    type: string
    kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNDER_REVIEW'
    preferences: {
        portfolioValue?: string
        activeInvestments?: string
        totalReturns?: string
        location?: string
        status?: string
        description?: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any
    }
}

export interface Deal {
    id: string
    title: string
    smeId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sme?: { name: string;[key: string]: any }
    amount: number
    stage: string
    status: string
    description: string
    equity?: number
    successFee?: number
    createdAt: string
    updatedAt?: string
}

export interface ApiError {
    error: string
    message?: string
}
