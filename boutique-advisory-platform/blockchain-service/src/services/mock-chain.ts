import crypto from 'crypto';
import { config } from '../config';

function randomHex(bytes: number): string {
  return `0x${crypto.randomBytes(bytes).toString('hex')}`;
}

export function mockMintToken() {
  return {
    status: 'MINTED' as const,
    txHash: randomHex(32),
    tokenContractAddress: randomHex(20),
    chainId: config.chainId,
  };
}

export function mockEscrowTx() {
  return {
    status: 'SUBMITTED' as const,
    txHash: randomHex(32),
    chainId: config.chainId,
  };
}
