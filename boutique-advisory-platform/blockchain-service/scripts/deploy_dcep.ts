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

function compileDcep() {
  const baseDir = path.resolve(__dirname, '../contracts');
  const sources: Record<string, { content: string }> = {
    'DcepNFT.sol': { content: fs.readFileSync(path.join(baseDir, 'DcepNFT.sol'), 'utf8') },
  };

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      evmVersion: 'paris',
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

  return output.contracts['DcepNFT.sol']['DcepNFT'];
}

async function deploy() {
  const artifact = compileDcep();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);
  const contract = await factory.deploy(wallet.address, 'DCEP Bill', 'DCEP');
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('DCEP_CONTRACT_ADDRESS=' + address);
  console.log('DCEP_ISSUER_ADDRESS=' + wallet.address);
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});
