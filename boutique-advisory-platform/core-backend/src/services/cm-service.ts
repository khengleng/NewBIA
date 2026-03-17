import { cmApiClient } from '../config/external-services';

export interface CMCase {
  id: string;
  type: string;
  status: string;
  data: any;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CMWorkflow {
  id: string;
  caseId: string;
  type: string;
  status: string;
  steps: any[];
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface CMUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

export class CMService {
  // Create a case in CM system
  static async createCase(
    type: string,
    data: any,
    assignedTo?: string
  ): Promise<CMCase> {
    try {
      const response = await cmApiClient.post('/api/cases', {
        type,
        data,
        assignedTo,
        status: 'OPEN',
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating CM case:', error);
      throw new Error('Failed to create case in CM system');
    }
  }

  // Get case by ID
  static async getCase(caseId: string): Promise<CMCase> {
    try {
      const response = await cmApiClient.get(`/api/cases/${caseId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting CM case:', error);
      throw new Error('Failed to get case from CM system');
    }
  }

  // Update case status
  static async updateCaseStatus(
    caseId: string,
    status: string,
    data?: any
  ): Promise<CMCase> {
    try {
      const response = await cmApiClient.put(`/api/cases/${caseId}`, {
        status,
        data,
        updatedAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error updating CM case:', error);
      throw new Error('Failed to update case in CM system');
    }
  }

  // Assign case to user
  static async assignCase(
    caseId: string,
    userId: string
  ): Promise<CMCase> {
    try {
      const response = await cmApiClient.put(`/api/cases/${caseId}/assign`, {
        assignedTo: userId,
        updatedAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error assigning CM case:', error);
      throw new Error('Failed to assign case in CM system');
    }
  }

  // Create workflow for case
  static async createWorkflow(
    caseId: string,
    type: string,
    steps: any[]
  ): Promise<CMWorkflow> {
    try {
      const response = await cmApiClient.post('/api/workflows', {
        caseId,
        type,
        steps,
        status: 'ACTIVE',
        currentStep: 0,
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating CM workflow:', error);
      throw new Error('Failed to create workflow in CM system');
    }
  }

  // Update workflow step
  static async updateWorkflowStep(
    workflowId: string,
    stepIndex: number,
    stepData: any
  ): Promise<CMWorkflow> {
    try {
      const response = await cmApiClient.put(`/api/workflows/${workflowId}/step`, {
        stepIndex,
        stepData,
        updatedAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error updating CM workflow step:', error);
      throw new Error('Failed to update workflow step in CM system');
    }
  }

  // Get workflow by ID
  static async getWorkflow(workflowId: string): Promise<CMWorkflow> {
    try {
      const response = await cmApiClient.get(`/api/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting CM workflow:', error);
      throw new Error('Failed to get workflow from CM system');
    }
  }

  // Get cases by type
  static async getCasesByType(type: string): Promise<CMCase[]> {
    try {
      const response = await cmApiClient.get(`/api/cases/type/${type}`);
      return response.data;
    } catch (error) {
      console.error('Error getting CM cases by type:', error);
      throw new Error('Failed to get cases from CM system');
    }
  }

  // Get cases assigned to user
  static async getCasesByUser(userId: string): Promise<CMCase[]> {
    try {
      const response = await cmApiClient.get(`/api/cases/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting CM cases by user:', error);
      throw new Error('Failed to get user cases from CM system');
    }
  }

  // Get user from CM system
  static async getUser(userId: string): Promise<CMUser> {
    try {
      const response = await cmApiClient.get(`/api/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting CM user:', error);
      throw new Error('Failed to get user from CM system');
    }
  }

  // Create user in CM system
  static async createUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }): Promise<CMUser> {
    try {
      const response = await cmApiClient.post('/api/users', {
        ...userData,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating CM user:', error);
      throw new Error('Failed to create user in CM system');
    }
  }

  // Get audit logs for case
  static async getCaseAuditLogs(caseId: string): Promise<any[]> {
    try {
      const response = await cmApiClient.get(`/api/cases/${caseId}/audit-logs`);
      return response.data;
    } catch (error) {
      console.error('Error getting CM case audit logs:', error);
      throw new Error('Failed to get audit logs from CM system');
    }
  }

  // Create audit log entry
  static async createAuditLog(
    caseId: string,
    action: string,
    data: any,
    userId: string
  ): Promise<any> {
    try {
      const response = await cmApiClient.post(`/api/cases/${caseId}/audit-logs`, {
        action,
        data,
        userId,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error creating CM audit log:', error);
      throw new Error('Failed to create audit log in CM system');
    }
  }

  // Get dashboard statistics
  static async getDashboardStats(): Promise<any> {
    try {
      const response = await cmApiClient.get('/api/dashboard/stats');
      return response.data;
    } catch (error) {
      console.error('Error getting CM dashboard stats:', error);
      throw new Error('Failed to get dashboard stats from CM system');
    }
  }
}
