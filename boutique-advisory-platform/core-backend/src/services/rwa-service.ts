import { rwaApiClient } from '../config/external-services';

export interface RWAToken {
  id: string;
  symbol: string;
  name: string;
  totalSupply: number;
  decimals: number;
  issuer: string;
  status: string;
  metadata: any;
}

export interface RWAInvestment {
  id: string;
  tokenId: string;
  investorId: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RWAIssuance {
  id: string;
  tokenId: string;
  amount: number;
  recipient: string;
  status: string;
  createdAt: string;
}

export class RWAService {
  // Create a new RWA token for an SME
  static async createToken(
    smeId: string,
    tokenData: {
      symbol: string;
      name: string;
      totalSupply: number;
      decimals: number;
      metadata: any;
    }
  ): Promise<RWAToken> {
    try {
      const response = await rwaApiClient.post('/tokens/create', {
        issuer: smeId,
        ...tokenData,
        status: 'PENDING'
      });

      return response.data;
    } catch (error) {
      console.error('Error creating RWA token:', error);
      throw new Error('Failed to create RWA token');
    }
  }

  // Get token by ID
  static async getToken(tokenId: string): Promise<RWAToken> {
    try {
      const response = await rwaApiClient.get(`/tokens/${tokenId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting RWA token:', error);
      throw new Error('Failed to get RWA token');
    }
  }

  // List tokens for an issuer
  static async listTokensByIssuer(issuerId: string): Promise<RWAToken[]> {
    try {
      const response = await rwaApiClient.get(`/tokens/issuer/${issuerId}`);
      return response.data;
    } catch (error) {
      console.error('Error listing RWA tokens:', error);
      throw new Error('Failed to list RWA tokens');
    }
  }

  // Issue tokens to an investor
  static async issueTokens(
    tokenId: string,
    investorId: string,
    amount: number
  ): Promise<RWAIssuance> {
    try {
      const response = await rwaApiClient.post('/issuance/create', {
        tokenId,
        recipient: investorId,
        amount,
        status: 'PENDING'
      });

      return response.data;
    } catch (error) {
      console.error('Error issuing RWA tokens:', error);
      throw new Error('Failed to issue RWA tokens');
    }
  }

  // Get investor's portfolio
  static async getInvestorPortfolio(investorId: string): Promise<RWAInvestment[]> {
    try {
      const response = await rwaApiClient.get(`/investments/investor/${investorId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting investor portfolio:', error);
      throw new Error('Failed to get investor portfolio');
    }
  }

  // Create investment record
  static async createInvestment(
    tokenId: string,
    investorId: string,
    amount: number
  ): Promise<RWAInvestment> {
    try {
      const response = await rwaApiClient.post('/investments/create', {
        tokenId,
        investorId,
        amount,
        status: 'PENDING'
      });

      return response.data;
    } catch (error) {
      console.error('Error creating RWA investment:', error);
      throw new Error('Failed to create RWA investment');
    }
  }

  // Update investment status
  static async updateInvestmentStatus(
    investmentId: string,
    status: string
  ): Promise<RWAInvestment> {
    try {
      const response = await rwaApiClient.put(`/investments/${investmentId}`, {
        status,
        updatedAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error updating RWA investment:', error);
      throw new Error('Failed to update RWA investment');
    }
  }

  // Get token holders
  static async getTokenHolders(tokenId: string): Promise<any[]> {
    try {
      const response = await rwaApiClient.get(`/tokens/${tokenId}/holders`);
      return response.data;
    } catch (error) {
      console.error('Error getting token holders:', error);
      throw new Error('Failed to get token holders');
    }
  }

  // Transfer tokens between investors
  static async transferTokens(
    tokenId: string,
    fromInvestorId: string,
    toInvestorId: string,
    amount: number
  ): Promise<any> {
    try {
      const response = await rwaApiClient.post('/transfers/create', {
        tokenId,
        from: fromInvestorId,
        to: toInvestorId,
        amount,
        status: 'PENDING'
      });

      return response.data;
    } catch (error) {
      console.error('Error transferring RWA tokens:', error);
      throw new Error('Failed to transfer RWA tokens');
    }
  }

  // Get token market data
  static async getTokenMarketData(tokenId: string): Promise<any> {
    try {
      const response = await rwaApiClient.get(`/tokens/${tokenId}/market-data`);
      return response.data;
    } catch (error) {
      console.error('Error getting token market data:', error);
      throw new Error('Failed to get token market data');
    }
  }

  // Create compliance report for token
  static async createComplianceReport(
    tokenId: string,
    reportData: any
  ): Promise<any> {
    try {
      const response = await rwaApiClient.post('/compliance/reports', {
        tokenId,
        reportData,
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating compliance report:', error);
      throw new Error('Failed to create compliance report');
    }
  }

  // Get compliance reports for token
  static async getComplianceReports(tokenId: string): Promise<any[]> {
    try {
      const response = await rwaApiClient.get(`/compliance/reports/${tokenId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting compliance reports:', error);
      throw new Error('Failed to get compliance reports');
    }
  }
}
