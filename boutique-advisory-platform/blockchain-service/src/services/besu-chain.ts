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

const DCEP_NFT_ABI = [
  'function mint(address to, uint256 tokenId, string moneyType, string serialNumber, string signature) external',
  'function tokensOfOwner(address owner) view returns (uint256[])',
  'function tokenData(uint256 tokenId) view returns (address owner, string moneyType, string serialNumber, string signature)',
  'function safeTransferFrom(address from, address to, uint256 tokenId) external',
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

function getDcepContractWithSigner() {
  if (!config.dcepContractAddress) {
    throw new Error('DCEP_CONTRACT_ADDRESS not configured');
  }
  const signer = getSigner();
  return new ethers.Contract(config.dcepContractAddress, DCEP_NFT_ABI, signer);
}

function getDcepContractReadOnly() {
  if (!config.dcepContractAddress) {
    throw new Error('DCEP_CONTRACT_ADDRESS not configured');
  }
  const provider = getProvider();
  return new ethers.Contract(config.dcepContractAddress, DCEP_NFT_ABI, provider);
}

export async function mintDcepOnBesu(payload: {
  ownerAddress: string;
  tokenId: string;
  moneyType: string;
  serialNumber: string;
  signature: string;
}) {
  const contract = getDcepContractWithSigner();
  const tx = await contract.mint(
    payload.ownerAddress,
    ethers.toBigInt(payload.tokenId),
    payload.moneyType,
    payload.serialNumber,
    payload.signature
  );
  const receipt = await tx.wait();
  return { txHash: tx.hash, chainId: config.chainId, blockNumber: receipt?.blockNumber };
}

export async function listDcepOnBesu(ownerAddress: string) {
  const contract = getDcepContractReadOnly();
  const tokenIds: bigint[] = await contract.tokensOfOwner(ownerAddress);
  const items = [];
  for (const tokenId of tokenIds) {
    const data = await contract.tokenData(tokenId);
    items.push({
      tokenId: tokenId.toString(),
      owner: data[0],
      moneyType: data[1],
      serialNumber: data[2],
      signature: data[3],
    });
  }
  return items;
}

export async function transferSignedDcepOnBesu(payload: {
  signedRawTransaction: string;
  expectedFrom: string;
  expectedTo?: string;
}) {
  if (!config.dcepContractAddress) {
    throw new Error('DCEP_CONTRACT_ADDRESS not configured');
  }
  const provider = getProvider();
  const tx = ethers.Transaction.from(payload.signedRawTransaction);

  if (!tx.from) {
    throw new Error('Unable to recover sender from signed transaction');
  }

  if (!tx.to) {
    throw new Error('Signed transaction missing destination');
  }

  if (tx.to.toLowerCase() !== config.dcepContractAddress.toLowerCase()) {
    throw new Error('Signed transaction target mismatch');
  }

  if (tx.from.toLowerCase() !== payload.expectedFrom.toLowerCase()) {
    throw new Error('Signed transaction sender mismatch');
  }

  const iface = new ethers.Interface(DCEP_NFT_ABI);
  const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
  if (!parsed || parsed.name !== 'safeTransferFrom') {
    throw new Error('Signed transaction is not a DCEP transfer');
  }

  const [, to] = parsed.args as unknown as [string, string, bigint];
  if (payload.expectedTo && to.toLowerCase() !== payload.expectedTo.toLowerCase()) {
    throw new Error('Signed transaction recipient mismatch');
  }

  const sent = await provider.broadcastTransaction(payload.signedRawTransaction);
  const receipt = await sent.wait();
  return {
    txHash: sent.hash,
    chainId: config.chainId,
    blockNumber: receipt?.blockNumber,
    to,
  };
}
