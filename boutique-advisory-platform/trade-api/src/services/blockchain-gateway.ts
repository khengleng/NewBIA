import { blockchainApiClient, blockchainConfig } from '../config/external-services';

export type OnchainMintResult = {
  status: 'MINTED' | 'PENDING' | 'FAILED' | 'SKIPPED';
  txHash?: string;
  tokenContractAddress?: string;
  chainId?: number;
  error?: string;
};

type MintRequest = {
  tenantId: string;
  dealId: string;
  syndicateId: string;
  tokenName: string;
  tokenSymbol: string;
  totalTokens: number;
  pricePerToken: number;
  ownerUserId?: string;
};

export async function mintTokenOnChain(payload: MintRequest): Promise<OnchainMintResult> {
  if (!blockchainConfig.api.baseURL || blockchainConfig.mode === 'disabled') {
    return { status: 'SKIPPED' };
  }

  try {
    const response = await blockchainApiClient.post('/api/blockchain/token/mint', payload);
    const data = response.data || {};
    if (data?.status === 'MINTED') {
      return {
        status: 'MINTED',
        txHash: data.txHash,
        tokenContractAddress: data.tokenContractAddress,
        chainId: data.chainId,
      };
    }
    return {
      status: data?.status || 'PENDING',
      txHash: data?.txHash,
      tokenContractAddress: data?.tokenContractAddress,
      chainId: data?.chainId,
    };
  } catch (error: any) {
    return {
      status: 'FAILED',
      error: error?.message || 'Blockchain mint failed',
    };
  }
}
