import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { ethers } from 'ethers';

const rpcUrl = process.env.BESU_RPC_URL;
const signerKey = process.env.BLOCKCHAIN_SIGNER_KEY;

if (!rpcUrl || !signerKey) {
  throw new Error('BESU_RPC_URL and BLOCKCHAIN_SIGNER_KEY are required');
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(signerKey, provider);

function compileContracts() {
  const baseDir = path.resolve(__dirname, '../contracts');
  const sources: Record<string, { content: string }> = {
    'TokenFactory.sol': { content: fs.readFileSync(path.join(baseDir, 'TokenFactory.sol'), 'utf8') },
    'Escrow.sol': { content: fs.readFileSync(path.join(baseDir, 'Escrow.sol'), 'utf8') },
  };

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length) {
      throw new Error(errors.map((e: any) => e.formattedMessage).join('\n'));
    }
  }

  return output.contracts;
}

async function deploy() {
  const contracts = compileContracts();

  const factoryArtifact = contracts['TokenFactory.sol']['TokenFactory'];
  const escrowArtifact = contracts['Escrow.sol']['LaunchpadEscrow'];

  const factory = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.evm.bytecode.object, wallet);
  const escrow = new ethers.ContractFactory(escrowArtifact.abi, escrowArtifact.evm.bytecode.object, wallet);

  const factoryContract = await factory.deploy();
  await factoryContract.waitForDeployment();

  const escrowContract = await escrow.deploy();
  await escrowContract.waitForDeployment();

  const factoryAddress = await factoryContract.getAddress();
  const escrowAddress = await escrowContract.getAddress();

  console.log('TOKEN_FACTORY_ADDRESS=' + factoryAddress);
  console.log('ESCROW_CONTRACT_ADDRESS=' + escrowAddress);
  console.log('TOKEN_OWNER_ADDRESS=' + wallet.address);
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});
