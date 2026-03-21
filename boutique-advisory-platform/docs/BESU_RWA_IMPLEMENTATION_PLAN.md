# Besu Permissioned RWA Plan (Layer 0 + Layer 1)

This document captures the agreed two-layer model:

Layer 0 is your existing off-chain tokenization in `cambobia.com`.
Layer 1 is a permissioned Besu network that mirrors issuance and enforces compliant transfers.

It includes:

1. Besu network setup (roles, config, permissioning).
2. Tokenized investment contract specification (ERC-3643 style + launchpad escrow).
3. Exact code change map across `cambobia.com`, `trade.cambobia.com`, and the mobile wallet.

## 1) Besu Network Setup Draft

### 1.1 Node Roles

- Bootnode
- Validators (IBFT 2.0 PoA)
- RPC Gateway nodes (public API access for apps)
- Archive / Indexer node (optional, for analytics and audit)
- Permissioning admin node (optional, for allowlist management)

The Besu permissioned network tutorial uses IBFT 2.0 PoA and `besu operator generate-blockchain-config` to create the genesis file and validator keys. citeturn15view0

### 1.2 Genesis + Keys (IBFT 2.0)

Besu’s permissioned network tutorial shows the standard flow:

1. Create a base directory with per-node data folders.
2. Create an `ibftConfigFile.json`.
3. Run `besu operator generate-blockchain-config` to produce `genesis.json` and validator keypairs. citeturn15view0

Example (from the tutorial):

```json
{
  "genesis": {
    "config": {
      "chainId": 1337,
      "berlinBlock": 0,
      "ibft2": {
        "blockperiodseconds": 2,
        "epochlength": 30000,
        "requesttimeoutseconds": 4
      }
    },
    "nonce": "0x0",
    "timestamp": "0x58ee40ba",
    "gasLimit": "0x47b760",
    "difficulty": "0x1",
    "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
    "coinbase": "0x0000000000000000000000000000000000000000",
    "alloc": {}
  },
  "blockchain": {
    "nodes": {
      "generate": true,
      "count": 4
    }
  }
}
```

Command:

```
besu operator generate-blockchain-config --config-file=ibftConfigFile.json --to=networkFiles --private-key-file-name=key
```

The output includes `genesis.json` plus per-validator keypairs. citeturn15view0

### 1.3 Permissioning (Local Allowlists)

Besu local permissioning supports node allowlisting and account allowlisting using a permissions config file per node. citeturn11view0

Key points from the Besu docs:

- Node allowlists restrict P2P connectivity to approved enodes. citeturn11view0
- Account allowlists restrict which sender accounts can submit transactions. citeturn11view0
- Enable allowlisting with `--permissions-nodes-config-file-enabled` and `--permissions-accounts-config-file-enabled`. citeturn11view0
- You can update allowlists at runtime with PERM JSON-RPC methods like `perm_addNodesToAllowlist` and `perm_addAccountsToAllowlist`. citeturn11view0

Example `permissions_config.toml`:

```toml
nodes-allowlist=[
  "enode://<bootnode_pubkey>@<bootnode_host>:30303",
  "enode://<validator1_pubkey>@<validator1_host>:30303"
]
accounts-allowlist=[
  "0x<allowed_sender_1>",
  "0x<allowed_sender_2>"
]
```

### 1.4 Permissioning (On-Chain Option)

If you want on-chain permissioning management instead of local files, Besu supports it with permissioning smart contracts. The official permissioning contracts repository is archived, but the contracts still exist and are documented for Besu usage. citeturn16view0

For Phase 1, I recommend using local allowlists for simplicity and determinism. We can migrate to on-chain permissioning later if you need dynamic governance rules.

## 2) Tokenized Investment Contract Spec (ERC-3643 Style)

We want a permissioned security token that mirrors your existing off-chain tokenization.

### 2.1 Why ERC-3643

ERC-3643 (T-REX) is a security token standard designed for permissioned assets. It is ERC-20 compatible, integrates on-chain identity checks, enforces compliance rules on transfer, and supports token pausing, freezing, mint/burn, and agent roles. citeturn6view0

Key requirements from ERC-3643:

- ERC-20 compatibility. citeturn6view0
- Identity registry and compliance checks for every transfer. citeturn6view0
- `canTransfer` pre-check to validate compliance before transfer. citeturn6view0
- Token pausing and wallet freezing. citeturn6view0
- Mint and burn support. citeturn6view0
- Agent role for operational functions. citeturn6view0

### 2.2 Contract Modules

We will implement a minimal ERC-3643 style suite:

- `InvestmentToken` (ERC-20 compatible, ERC-3643 transfer hooks)
- `IdentityRegistry` (KYC / whitelist)
- `Compliance` (global rules, e.g. cap per investor, jurisdiction flags)
- `ClaimIssuerRegistry` (trusted issuers)
- `LaunchpadEscrow` (optional, on-chain escrow for launchpad)

### 2.3 InvestmentToken Interface (Core)

The contract must support:

- `mint(to, amount)` for issuance
- `burn(from, amount)` for redemption
- `transfer` and `transferFrom` with compliance + identity checks
- `pause` and `unpause`
- `freeze(address)` and `unfreeze(address)`
- `forcedTransfer(from, to, amount)` for regulatory actions

ERC-3643 explicitly defines identity checks, compliance checks, token freezing and pausing, agent role permissions, and transfer pre-checks. citeturn6view0

### 2.4 Launchpad Escrow Contract (Optional)

This is your on-chain escrow layer.

Required behaviors:

- `commit(offeringId, amount, investor)` locks funds (or stablecoins) in escrow.
- `allocate(offeringId, allocations[])` mints tokens to investors and releases escrow.
- `refund(offeringId, investors[])` returns funds for rejected or oversubscribed commitments.
- All transfers should follow the same permissioned token rules.

On-chain escrow mirrors your current launchpad flow but guarantees on-chain settlement once an offering is finalized.

## 3) Exact Code Change Map

This section maps the exact files and changes required to support the two-layer model.

### 3.1 cambobia.com (core platform)

Backend changes:

- Add blockchain metadata fields to Syndicate
  - Files:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/core-backend/prisma/schema.prisma`
    - `/Users/mlh/NewBIA/boutique-advisory-platform/trade-api/prisma/schema.prisma`
  - Fields:
    - `tokenContractAddress`
    - `tokenChainId`
    - `mintTxHash`
    - `onchainStatus` (PENDING, MINTED, FAILED)
    - `launchpadEscrowAddress` (optional)

- Add on-chain minting hook during tokenization
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/trade-api/src/routes/deal.ts`
  - Change:
    - After syndicate creation, call new Blockchain Gateway service to deploy or mint ERC-3643 token.
    - Store `tokenContractAddress`, `mintTxHash`, `onchainStatus`.

- Add on-chain sync endpoints
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/core-backend/src/routes/syndicate-tokens.ts`
  - Change:
    - Add endpoints to fetch on-chain balances for syndicate members.

Frontend changes:

- Display on-chain status for tokenized syndicates
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/bia-frontend/src/app/syndicates/[id]/page.tsx`
  - Change:
    - Add “On-chain status” and “Token contract address” in Token Details.

- Tokenize modal should show on-chain mint state
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/bia-frontend/src/app/deals/[id]/page.tsx`
  - Change:
    - On success, show `mintTxHash` and `tokenContractAddress`.

### 3.2 trade.cambobia.com (secondary trading)

Backend changes:

- Settle trades on-chain
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/market-service/src/services/secondary-trade-settlement.ts`
  - Change:
    - After DB settlement, call Blockchain Gateway to execute on-chain token transfer.
    - Store tx hash on trade record.

- Launchpad escrow on-chain
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/market-service/src/routes/launchpad.ts`
  - Change:
    - On commitment, call LaunchpadEscrow `commit`.
    - On allocation, call `allocate`.
    - On refund, call `refund`.

- Syndicate token listing validations
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/market-service/src/routes/syndicate-tokens.ts`
  - Change:
    - Validate seller’s on-chain balance before listing.
    - Optionally lock tokens via escrow or compliance hook.

Frontend changes:

- Display on-chain contract addresses and transaction hashes
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/trading-frontend/src/...`
  - Change:
    - Show on-chain settlement status for listings and trades.

### 3.3 Mobile Wallet (twallet)

Backend changes:

- Add blockchain portfolio endpoints in BFF
  - File:
    - `/Users/mlh/NewBIA/boutique-advisory-platform/twallet-bff-service/src/app.ts`
  - New endpoints:
    - `GET /api/mobile/portfolio` (token balances, contract metadata)
    - `POST /api/mobile/token/transfer` (permissioned transfer)

Mobile app changes:

- Add Tokenized Assets screen
  - Files:
    - `/Users/mlh/NewBIA/twallet-app/lib/views/`
  - Shows:
    - On-chain token balances
    - Contract metadata (name/symbol/address)

- Add transfer flow for tokenized assets
  - Files:
    - `/Users/mlh/NewBIA/twallet-app/lib/views/transfer/`
  - Change:
    - Add token transfer option (not just wallet balance).

- Add wallet address management
  - Files:
    - `/Users/mlh/NewBIA/twallet-app/lib/store/mobile/`
  - Change:
    - Support for storing and displaying an on-chain address per user.

## 4) New “Blockchain Gateway” Service

You need one internal service to isolate all chain calls.

Recommended:

- `blockchain-service` (new folder inside `boutique-advisory-platform`)
- REST API:
  - `POST /token/mint`
  - `POST /token/transfer`
  - `GET /token/balance`
  - `POST /escrow/commit`
  - `POST /escrow/allocate`
  - `POST /escrow/refund`

This keeps cambobia.com and trade.cambobia.com clean, and makes it easy to swap chains later.

---

If you want me to implement the gateway service and wire the first mint flow end-to-end, tell me and I’ll proceed in the codebase.
