import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceName: 'blockchain-service',
  port: Number(process.env.PORT || 9100),
  mode: process.env.BLOCKCHAIN_MODE || 'mock',
  chainId: Number(process.env.CHAIN_ID || 1337),
  rpcUrl: process.env.BESU_RPC_URL || '',
  signerPrivateKey: process.env.BLOCKCHAIN_SIGNER_KEY || '',
  tokenFactoryAddress: process.env.TOKEN_FACTORY_ADDRESS || '',
  escrowContractAddress: process.env.ESCROW_CONTRACT_ADDRESS || '',
  tokenOwnerAddress: process.env.TOKEN_OWNER_ADDRESS || '',
  dcepContractAddress: process.env.DCEP_CONTRACT_ADDRESS || '',
};
