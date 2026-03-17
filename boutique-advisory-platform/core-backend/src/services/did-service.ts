import { didApiClient } from '../config/external-services';

export interface DIDCredential {
  id: string;
  type: string;
  issuer: string;
  subject: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: any;
  proof?: any;
}

export interface DIDWorkflow {
  id: string;
  type: string;
  status: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

export class DIDService {
  // Create a verifiable credential for SME certification
  static async createSMECertificationCredential(
    smeId: string,
    advisorId: string,
    certificationData: any
  ): Promise<DIDCredential> {
    try {
      const response = await didApiClient.post('/vc/issue', {
        type: 'SME_CERTIFICATION',
        issuer: advisorId,
        subject: smeId,
        credentialSubject: {
          smeId,
          certificationType: 'SME_CERTIFICATION',
          score: certificationData.score,
          certifiedBy: advisorId,
          certificationDate: new Date().toISOString(),
          ...certificationData
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating SME certification credential:', error);
      throw new Error('Failed to create verifiable credential');
    }
  }

  // Create a verifiable credential for investor KYC
  static async createInvestorKYCCredential(
    investorId: string,
    kycData: any
  ): Promise<DIDCredential> {
    try {
      const response = await didApiClient.post('/vc/issue', {
        type: 'INVESTOR_KYC',
        issuer: 'BoutiqueAdvisory',
        subject: investorId,
        credentialSubject: {
          investorId,
          kycType: 'INVESTOR_KYC',
          kycStatus: kycData.status,
          verifiedBy: 'BoutiqueAdvisory',
          verificationDate: new Date().toISOString(),
          ...kycData
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating investor KYC credential:', error);
      throw new Error('Failed to create verifiable credential');
    }
  }

  // Verify a credential
  static async verifyCredential(credentialId: string): Promise<boolean> {
    try {
      const response = await didApiClient.post(`/vc/verify/${credentialId}`);
      return response.data.verified;
    } catch (error) {
      console.error('Error verifying credential:', error);
      return false;
    }
  }

  // Create a workflow in DID infrastructure
  static async createWorkflow(
    type: string,
    data: any,
    participants: string[]
  ): Promise<DIDWorkflow> {
    try {
      const response = await didApiClient.post('/workflow/create', {
        type,
        data,
        participants,
        status: 'PENDING'
      });

      return response.data;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw new Error('Failed to create workflow');
    }
  }

  // Update workflow status
  static async updateWorkflowStatus(
    workflowId: string,
    status: string,
    data?: any
  ): Promise<DIDWorkflow> {
    try {
      const response = await didApiClient.put(`/workflow/${workflowId}`, {
        status,
        data,
        updatedAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw new Error('Failed to update workflow');
    }
  }

  // Get workflow by ID
  static async getWorkflow(workflowId: string): Promise<DIDWorkflow> {
    try {
      const response = await didApiClient.get(`/workflow/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting workflow:', error);
      throw new Error('Failed to get workflow');
    }
  }

  // Create attestation for deal approval
  static async createDealAttestation(
    dealId: string,
    attestationData: any
  ): Promise<any> {
    try {
      const response = await didApiClient.post('/attestation/create', {
        type: 'DEAL_APPROVAL',
        subject: dealId,
        data: attestationData,
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating deal attestation:', error);
      throw new Error('Failed to create attestation');
    }
  }

  // Get user's DID
  static async getUserDID(userId: string): Promise<string | null> {
    try {
      const response = await didApiClient.get(`/user/${userId}/did`);
      return response.data.did;
    } catch (error) {
      console.error('Error getting user DID:', error);
      return null;
    }
  }

  // Register user with DID infrastructure
  static async registerUser(userData: {
    id: string;
    email: string;
    name: string;
  }): Promise<string> {
    try {
      const response = await didApiClient.post('/user/register', userData);
      return response.data.did;
    } catch (error) {
      console.error('Error registering user with DID:', error);
      throw new Error('Failed to register user with DID infrastructure');
    }
  }
}
