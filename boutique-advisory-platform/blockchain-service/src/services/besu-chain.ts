import { ethers } from 'ethers';
import { config } from '../config';

const TOKEN_FACTORY_ABI = [
  'event TokenCreated(address indexed tokenAddress, string name, string symbol)',
  'function createToken(string name, string symbol, uint256 totalSupply, address owner) returns (address)',
];

const ESCROW_ABI = [
  'function commit(bytes32 offeringId, bytes32 investorId, uint256 amount) external',
  'function allocate(bytes32 offeringId, bytes32 investorId, uint256 tokenAmount) external',
  'function refund(bytes32 offeringId, bytes32 investorId, uint256 amount) external',
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

function getProvider(): ethers.JsonRpcProvider {
  if (!config.rpcUrl) {
    throw new Error('BESU_RPC_URL not configured');
  }
  return new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
}

function getSigner(): ethers.Wallet {
  if (!config.signerPrivateKey) {
    throw new Error('BLOCKCHAIN_SIGNER_KEY not configured');
  }
  return new ethers.Wallet(config.signerPrivateKey, getProvider());
}

function asId(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

export async function mintTokenOnBesu(payload: {
  tokenName: string;
  tokenSymbol: string;
  totalTokens: number;
  ownerAddress?: string;
}) {
  if (!config.tokenFactoryAddress) {
    throw new Error('TOKEN_FACTORY_ADDRESS not configured');
  }

  const ownerAddress = payload.ownerAddress || config.tokenOwnerAddress;
  if (!ownerAddress) {
    throw new Error('TOKEN_OWNER_ADDRESS not configured');
  }

  const signer = getSigner();
  const factory = new ethers.Contract(config.tokenFactoryAddress, TOKEN_FACTORY_ABI, signer);
  const tx = await factory.createToken(
    payload.tokenName,
    payload.tokenSymbol,
    ethers.parseUnits(String(payload.totalTokens), 0),
    ownerAddress
  );

  const receipt = await tx.wait();
  let tokenAddress: string | undefined;
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog(log);
        if (parsed?.name === 'TokenCreated') {
          tokenAddress = parsed.args?.tokenAddress as string | undefined;
          break;
        }
      } catch {
        // ignore non-factory logs
      }
    }
  }

  return {
    txHash: tx.hash,
    tokenContractAddress: tokenAddress,
    chainId: config.chainId,
  };
}

export async function commitEscrowOnBesu(payload: { offeringId: string; investorId: string; amount: number }) {
  if (!config.escrowContractAddress) {
    throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
  }
  const signer = getSigner();
  const escrow = new ethers.Contract(config.escrowContractAddress, ESCROW_ABI, signer);
  const tx = await escrow.commit(asId(payload.offeringId), asId(payload.investorId), ethers.parseUnits(String(payload.amount), 0));
  const receipt = await tx.wait();
  return { txHash: tx.hash, chainId: config.chainId, blockNumber: receipt?.blockNumber };
}

export async function allocateEscrowOnBesu(payload: { offeringId: string; investorId: string; tokens: number }) {
  if (!config.escrowContractAddress) {
    throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
  }
  const signer = getSigner();
  const escrow = new ethers.Contract(config.escrowContractAddress, ESCROW_ABI, signer);
  const tx = await escrow.allocate(asId(payload.offeringId), asId(payload.investorId), ethers.parseUnits(String(payload.tokens), 0));
  const receipt = await tx.wait();
  return { txHash: tx.hash, chainId: config.chainId, blockNumber: receipt?.blockNumber };
}

export async function refundEscrowOnBesu(payload: { offeringId: string; investorId: string; amount: number }) {
  if (!config.escrowContractAddress) {
    throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
  }
  const signer = getSigner();
  const escrow = new ethers.Contract(config.escrowContractAddress, ESCROW_ABI, signer);
  const tx = await escrow.refund(asId(payload.offeringId), asId(payload.investorId), ethers.parseUnits(String(payload.amount), 0));
  const receipt = await tx.wait();
  return { txHash: tx.hash, chainId: config.chainId, blockNumber: receipt?.blockNumber };
}

export async function getTokenBalanceOnBesu(payload: { tokenAddress: string; walletAddress: string }) {
  const provider = getProvider();
  const token = new ethers.Contract(payload.tokenAddress, ERC20_ABI, provider);
  const [balance, decimals] = await Promise.all([token.balanceOf(payload.walletAddress), token.decimals()]);
  return {
    balance: balance.toString(),
    decimals: Number(decimals),
  };
}
