export const IDENTITY_REGISTRY_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "did",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      }
    ],
    "name": "IdentityRegistered",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "did",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "dappId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "extra",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "publicKey",
        "type": "string"
      }
    ],
    "name": "registerIdentity",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "identityOf",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "names",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "dids",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "dappIds",
        "type": "string[]"
      },
      {
        "internalType": "uint256[]",
        "name": "indexes",
        "type": "uint256[]"
      },
      {
        "internalType": "string[]",
        "name": "extras",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "publicKeys",
        "type": "string[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
