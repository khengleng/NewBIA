# Besu on Railway (Permissioned)

This folder contains a minimal permissioned Besu network intended to run on Railway.
It uses a bootnode, two validators, and one RPC node.

## Services
- `besu/bootnode`
- `besu/validator1`
- `besu/validator2`
- `besu/rpc`

## Notes
- Each service is built from its own Dockerfile.
- All nodes share the same genesis and static-nodes file (mounted via copy).
- Generate genesis + validator keys with `besu/scripts/generate-network.sh`.
- Private keys are **not** committed. Set them in Railway env vars per service.

## IMPORTANT
Do **not** expose private keys outside of private repos. Rotate keys in production.

## Env Vars (per service)
- `BESU_NETWORK_ID` (e.g. `20260321`)
- `BESU_BOOTNODE_ENODE` (full enode URL for bootnode)
- `BESU_STATIC_NODES` (path inside container, default `/opt/besu/static-nodes.json`)
- `BESU_GENESIS` (path inside container, default `/opt/besu/genesis.json`)
- `BESU_DATA_PATH` (default `/opt/besu/data`)

RPC service also exposes:
- `BESU_RPC_HTTP_ENABLED=true`
- `BESU_RPC_HTTP_HOST=0.0.0.0`
- `BESU_RPC_HTTP_PORT=8545`
- `BESU_RPC_HTTP_API=ETH,NET,WEB3,TXPOOL,PERM,IBFT`

## Railway Setup
Create four Railway services pointing to:
- `besu/bootnode/Dockerfile`
- `besu/validator1/Dockerfile`
- `besu/validator2/Dockerfile`
- `besu/rpc/Dockerfile`

Optional one-time key generator service:
- `besu/keygen/Dockerfile`

Expose ports:
- Bootnode: UDP 30303, TCP 30303
- Validators: TCP 30303
- RPC: TCP 8545 and 30303

## Local Generation Steps
1. Start Docker Desktop.
2. Run:
   ```bash
   /Users/mlh/NewBIA/besu/scripts/generate-network.sh
   ```
3. Update `besu/config/static-nodes.json` and `besu/config/permissions_config.toml` with:
   - the generated node public keys, and
   - Railway internal hostnames for each service.
4. Commit the updated `besu/config/genesis.json`, `besu/config/static-nodes.json`, `besu/config/permissions_config.toml`.
5. In Railway, set `BESU_NODE_PRIVATE_KEY` for each node (bootnode/validator1/validator2/rpc).

## Railway-Only Generation (No Local Docker)
1. Create a temporary Railway service from `besu/keygen/Dockerfile`.
2. Deploy and open logs. Copy:
   - `GENESIS_JSON_BASE64`
   - `validator1_private_key`, `validator2_private_key`
   - `validator1_public_key`, `validator2_public_key`
3. Build `static-nodes.json` + `permissions_config.toml` using the public keys and Railway internal hostnames.
4. Base64 those JSON/TOML files and set:
   - `BESU_GENESIS_B64`
   - `BESU_STATIC_NODES_B64`
   - `BESU_PERMISSIONS_B64`
   for each Besu service.
