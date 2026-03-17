import axios from 'axios';

// DID Infrastructure Integration
export const didConfig = {
  apiGateway: {
    baseURL: process.env.DID_API_GATEWAY_URL || 'http://localhost:8080',
    timeout: 10000,
  },
  vcService: {
    baseURL: process.env.DID_VC_SERVICE_URL || 'http://localhost:8080/vc',
    timeout: 10000,
  },
  workflowEngine: {
    baseURL: process.env.DID_WORKFLOW_ENGINE_URL || 'http://localhost:8080/workflow',
    timeout: 10000,
  },
  attestationService: {
    baseURL: process.env.DID_ATTESTATION_SERVICE_URL || 'http://localhost:8080/attestation',
    timeout: 10000,
  },
};

// CM Infrastructure Integration
export const cmConfig = {
  portal: {
    baseURL: process.env.CM_PORTAL_URL || 'http://localhost:3000',
    timeout: 10000,
  },
  keycloak: {
    baseURL: process.env.CM_KEYCLOAK_URL || 'http://localhost:8083',
    timeout: 10000,
  },
  vault: {
    baseURL: process.env.CM_VAULT_URL || 'http://localhost:8200',
    timeout: 10000,
  },
  postgres: {
    host: process.env.CM_POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.CM_POSTGRES_PORT || '5432'),
  },
};

// RWA Infrastructure Integration
export const rwaConfig = {
  api: {
    baseURL: process.env.RWA_API_URL || 'http://localhost:9000',
    timeout: 10000,
  },
  investorApp: {
    baseURL: process.env.RWA_INVESTOR_APP_URL || 'http://localhost:9002',
    timeout: 10000,
  },
  issuerConsole: {
    baseURL: process.env.RWA_ISSUER_CONSOLE_URL || 'http://localhost:9001',
    timeout: 10000,
  },
};

// Create axios instances for external services
export const didApiClient = axios.create({
  baseURL: didConfig.apiGateway.baseURL,
  timeout: didConfig.apiGateway.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const cmApiClient = axios.create({
  baseURL: cmConfig.portal.baseURL,
  timeout: cmConfig.portal.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const rwaApiClient = axios.create({
  baseURL: rwaConfig.api.baseURL,
  timeout: rwaConfig.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health check functions
export const checkDidHealth = async (): Promise<boolean> => {
  try {
    const response = await didApiClient.get('/health');
    return response.status === 200;
  } catch (error) {
    console.error('DID service health check failed:', error);
    return false;
  }
};

export const checkCmHealth = async (): Promise<boolean> => {
  try {
    const response = await cmApiClient.get('/api/health');
    return response.status === 200;
  } catch (error) {
    console.error('CM service health check failed:', error);
    return false;
  }
};

export const checkRwaHealth = async (): Promise<boolean> => {
  try {
    const response = await rwaApiClient.get('/health');
    return response.status === 200;
  } catch (error) {
    console.error('RWA service health check failed:', error);
    return false;
  }
};
