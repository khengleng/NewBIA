import axios from 'axios';

const baseURL = process.env.BLOCKCHAIN_GATEWAY_URL || '';
const mode = process.env.BLOCKCHAIN_GATEWAY_MODE || 'disabled';

const client = axios.create({
  baseURL: baseURL || 'http://localhost:9100',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export type OnchainResult = {
  status: 'SUBMITTED' | 'MINTED' | 'PENDING' | 'FAILED' | 'SKIPPED';
  txHash?: string;
  chainId?: number;
  error?: string;
};

export async function commitEscrow(payload: {
  offeringId: string;
  investorId: string;
  amount: number;
}): Promise<OnchainResult> {
  if (!baseURL || mode === 'disabled') {
    return { status: 'SKIPPED' };
  }
  try {
    const response = await client.post('/api/blockchain/escrow/commit', payload);
    const data = response.data || {};
    return {
      status: data.status || 'SUBMITTED',
      txHash: data.txHash,
      chainId: data.chainId,
    };
  } catch (error: any) {
    return { status: 'FAILED', error: error?.message || 'Escrow commit failed' };
  }
}

export async function allocateEscrow(payload: {
  offeringId: string;
  allocations: Array<{ investorId: string; tokens: number }>;
}): Promise<OnchainResult> {
  if (!baseURL || mode === 'disabled') {
    return { status: 'SKIPPED' };
  }
  try {
    const response = await client.post('/api/blockchain/escrow/allocate', payload);
    const data = response.data || {};
    return {
      status: data.status || 'SUBMITTED',
      txHash: data.txHash,
      chainId: data.chainId,
    };
  } catch (error: any) {
    return { status: 'FAILED', error: error?.message || 'Escrow allocation failed' };
  }
}

export async function getTokenBalance(payload: { tokenAddress: string; walletAddress: string }) {
  if (!baseURL || mode === 'disabled') {
    return { status: 'SKIPPED', balance: '0', decimals: 0 };
  }
  try {
    const response = await client.post('/api/blockchain/token/balance', payload);
    const data = response.data || {};
    return {
      status: data.status || 'OK',
      balance: data.balance || '0',
      decimals: Number(data.decimals || 0),
    };
  } catch (error: any) {
    return { status: 'FAILED', balance: '0', decimals: 0, error: error?.message || 'Balance lookup failed' };
  }
}
