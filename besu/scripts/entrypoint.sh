#!/usr/bin/env bash
set -euo pipefail

ROLE=${BESU_ROLE:-rpc}
DATA_PATH=${BESU_DATA_PATH:-/opt/besu/data}
GENESIS=${BESU_GENESIS:-/opt/besu/genesis.json}
STATIC_NODES=${BESU_STATIC_NODES:-/opt/besu/static-nodes.json}
PERM_CONFIG=${BESU_PERMISSIONS_CONFIG:-/opt/besu/permissions_config.toml}
NETWORK_ID=${BESU_NETWORK_ID:-20260321}

mkdir -p "$DATA_PATH"

if [[ -n "${BESU_GENESIS_B64:-}" ]]; then
  echo "$BESU_GENESIS_B64" | base64 -d > "$GENESIS"
fi

if [[ -n "${BESU_STATIC_NODES_B64:-}" ]]; then
  echo "$BESU_STATIC_NODES_B64" | base64 -d > "$STATIC_NODES"
fi

if [[ -n "${BESU_PERMISSIONS_B64:-}" ]]; then
  echo "$BESU_PERMISSIONS_B64" | base64 -d > "$PERM_CONFIG"
fi

if [[ -f "$STATIC_NODES" ]]; then
  HOSTS=$(grep -oE '[a-z0-9-]+\\.railway\\.internal' "$STATIC_NODES" | sort -u || true)
  resolve_host() {
    local host=$1
    if command -v getent >/dev/null 2>&1; then
      getent hosts "$host" | awk '{print $1}' | head -n1
      return
    fi
    if command -v nslookup >/dev/null 2>&1; then
      nslookup "$host" 2>/dev/null | awk '/Address: / {print $2}' | tail -n1
      return
    fi
    if command -v dig >/dev/null 2>&1; then
      dig +short "$host" | head -n1
      return
    fi
    if command -v ping >/dev/null 2>&1; then
      ping -c1 -W1 "$host" 2>/dev/null | head -n1 | sed -n 's/.*(\\([0-9.]*\\)).*/\\1/p'
      return
    fi
  }
  for HOST in $HOSTS; do
    IP=$(resolve_host "$HOST")
    if [[ -n "$IP" ]]; then
      sed -i "s/${HOST}/${IP}/g" "$STATIC_NODES" "$PERM_CONFIG" 2>/dev/null || true
    fi
  done
fi

NODE_KEY_ARGS=""
if [[ -n "${BESU_NODE_PRIVATE_KEY:-}" ]]; then
  echo -n "$BESU_NODE_PRIVATE_KEY" > "$DATA_PATH/key"
  chmod 600 "$DATA_PATH/key"
  NODE_KEY_ARGS="--node-private-key-file=$DATA_PATH/key"
fi

COMMON_ARGS=(
  "--data-path=$DATA_PATH"
  "--genesis-file=$GENESIS"
  "--network-id=$NETWORK_ID"
  "--sync-mode=FULL"
  "--min-gas-price=0"
  "--host-allowlist=*"
  "--p2p-port=30303"
  "--discovery-enabled=false"
)

if [[ "${BESU_SKIP_STATIC_NODES:-false}" != "true" ]]; then
  if [[ -f "$STATIC_NODES" ]] && [[ -s "$STATIC_NODES" ]]; then
    COMMON_ARGS+=("--static-nodes-file=$STATIC_NODES")
  fi
fi

if [[ "${BESU_PERMISSIONS_ENABLED:-true}" == "true" ]]; then
  COMMON_ARGS+=("--permissions-nodes-config-file-enabled" "--permissions-nodes-config-file=$PERM_CONFIG")
fi

if [[ "${BESU_ACCOUNTS_ALLOWLIST_ENABLED:-false}" == "true" ]]; then
  COMMON_ARGS+=("--permissions-accounts-config-file-enabled" "--permissions-accounts-config-file=$PERM_CONFIG")
fi

case "$ROLE" in
  bootnode)
    exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS
    ;;
  validator)
    if [[ -z "${BESU_COINBASE:-}" ]]; then
      echo "BESU_COINBASE is required for validator" >&2
      exit 1
    fi
    exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS --miner-enabled --miner-coinbase="$BESU_COINBASE"
    ;;
  rpc)
    RPC_ARGS=(
      "--rpc-http-enabled"
      "--rpc-http-api=ETH,NET,WEB3,TXPOOL,PERM,IBFT"
      "--rpc-http-host=0.0.0.0"
      "--rpc-http-port=8545"
      "--rpc-http-cors-origins=*"
    )
    if [[ "${BESU_ENABLE_MINER:-false}" == "true" ]]; then
      if [[ -z "${BESU_COINBASE:-}" ]]; then
        echo "BESU_COINBASE is required when BESU_ENABLE_MINER=true" >&2
        exit 1
      fi
      RPC_ARGS+=("--miner-enabled" "--miner-coinbase=$BESU_COINBASE")
    fi
    exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS "${RPC_ARGS[@]}"
    ;;
  *)
    echo "Unknown BESU_ROLE: $ROLE" >&2
    exit 1
    ;;
esac
