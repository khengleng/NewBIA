#!/usr/bin/env bash
set -euo pipefail
set -x

ROLE=${BESU_ROLE:-rpc}
DATA_PATH=${BESU_DATA_PATH:-/opt/besu/data}
GENESIS=${BESU_GENESIS:-/opt/besu/genesis.json}
STATIC_NODES=${BESU_STATIC_NODES:-/opt/besu/static-nodes.json}
PERM_CONFIG=${BESU_PERMISSIONS_CONFIG:-/opt/besu/permissions_config.toml}
NETWORK_ID=${BESU_NETWORK_ID:-20260321}
P2P_HOST=${BESU_P2P_HOST:-}
P2P_HOST_IPV6=${BESU_P2P_HOST_IPV6:-}
DISCOVERY_ENABLED=${BESU_DISCOVERY_ENABLED:-false}
V5_DISCOVERY_ENABLED=${BESU_V5_DISCOVERY_ENABLED:-false}
RPC_HTTP_ENABLED=${BESU_RPC_HTTP_ENABLED:-false}
RPC_HTTP_PORT=${BESU_RPC_HTTP_PORT:-${PORT:-8545}}

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
  HOSTS=$(sed -n 's/.*\([a-z0-9-]*\.railway\.internal\).*/\1/p' "$STATIC_NODES" | sort -u || true)
  resolve_host() {
    local host=$1
    local ipv4=""
    local ipv6=""
    if command -v getent >/dev/null 2>&1; then
      ipv4=$(getent hosts "$host" | awk '{print $1}' | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)
      ipv6=$(getent hosts "$host" | awk '{print $1}' | grep -E ':' | head -n1 || true)
    fi
    if command -v nslookup >/dev/null 2>&1; then
      ipv4=${ipv4:-$(nslookup "$host" 2>/dev/null | awk '/Address: / {print $2}' | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | tail -n1 || true)}
      ipv6=${ipv6:-$(nslookup "$host" 2>/dev/null | awk '/Address: / {print $2}' | grep -E ':' | tail -n1 || true)}
    fi
    if command -v dig >/dev/null 2>&1; then
      ipv4=${ipv4:-$(dig +short "$host" | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)}
      ipv6=${ipv6:-$(dig +short "$host" | grep -E ':' | head -n1 || true)}
    fi
    if command -v ping >/dev/null 2>&1; then
      ipv4=${ipv4:-$(ping -c1 -W1 "$host" 2>/dev/null | head -n1 | sed -n 's/.*(\\([0-9.]*\\)).*/\\1/p' | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)}
    fi
    if [[ -n "$ipv4" ]]; then
      echo "$ipv4"
      return
    fi
    if [[ -n "$ipv6" ]]; then
      echo "[$ipv6]"
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

echo "BESU_ROLE=$ROLE"
echo "BESU_DATA_PATH=$DATA_PATH"
echo "BESU_GENESIS=$GENESIS"
echo "BESU_STATIC_NODES=$STATIC_NODES"
echo "BESU_PERM_CONFIG=$PERM_CONFIG"
echo "BESU_NETWORK_ID=$NETWORK_ID"
echo "BESU_P2P_HOST=${P2P_HOST:-}"
echo "BESU_RPC_HTTP_ENABLED=${RPC_HTTP_ENABLED}"
echo "BESU_RPC_HTTP_PORT=${RPC_HTTP_PORT}"

if [[ -z "$P2P_HOST" ]]; then
  if command -v hostname >/dev/null 2>&1; then
    P2P_HOST=$(hostname -i 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)
  fi
fi

if [[ -n "$P2P_HOST" ]] && [[ "$P2P_HOST" == *:* ]]; then
  P2P_HOST_IPV6=""
fi

if [[ -z "$P2P_HOST_IPV6" ]] && [[ "$P2P_HOST" != *:* ]]; then
  if command -v hostname >/dev/null 2>&1; then
    P2P_HOST_IPV6=$(hostname -i 2>/dev/null | tr ' ' '\n' | grep -E ':' | head -n1 || true)
  fi
fi

echo "Resolved P2P_HOST=${P2P_HOST:-0.0.0.0}"
echo "Resolved P2P_HOST_IPV6=${P2P_HOST_IPV6:-}"

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
  "--p2p-host=${P2P_HOST:-0.0.0.0}"
  "--p2p-port=30303"
  "--discovery-enabled=${DISCOVERY_ENABLED}"
)

if [[ -n "$P2P_HOST_IPV6" ]]; then
  COMMON_ARGS+=("--p2p-host-ipv6=$P2P_HOST_IPV6")
fi

if [[ "${V5_DISCOVERY_ENABLED}" == "true" ]]; then
  COMMON_ARGS+=("--Xv5-discovery-enabled")
fi

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
    if [[ "${RPC_HTTP_ENABLED}" == "true" ]]; then
      RPC_ARGS=(
        "--rpc-http-enabled=true"
        "--rpc-http-api=ETH,NET,WEB3,TXPOOL,PERM,IBFT"
        "--rpc-http-host=0.0.0.0"
        "--rpc-http-port=${RPC_HTTP_PORT}"
        "--rpc-http-cors-origins=*"
      )
      exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS "${RPC_ARGS[@]}"
    else
      exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS
    fi
    ;;
  validator)
    COMMON_ARGS+=("--miner-enabled=true")
    if [[ "${RPC_HTTP_ENABLED}" == "true" ]]; then
      RPC_ARGS=(
        "--rpc-http-enabled=true"
        "--rpc-http-api=ETH,NET,WEB3,TXPOOL,PERM,IBFT"
        "--rpc-http-host=0.0.0.0"
        "--rpc-http-port=${RPC_HTTP_PORT}"
        "--rpc-http-cors-origins=*"
      )
      exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS "${RPC_ARGS[@]}"
    else
      exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS
    fi
    ;;
  rpc)
    RPC_ARGS=(
      "--rpc-http-enabled=true"
      "--rpc-http-api=ETH,NET,WEB3,TXPOOL,PERM,IBFT"
      "--rpc-http-host=0.0.0.0"
      "--rpc-http-port=${RPC_HTTP_PORT}"
      "--rpc-http-cors-origins=*"
    )
    exec besu "${COMMON_ARGS[@]}" $NODE_KEY_ARGS "${RPC_ARGS[@]}"
    ;;
  *)
    echo "Unknown BESU_ROLE: $ROLE" >&2
    exit 1
    ;;
esac
