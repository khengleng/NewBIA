#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

rm -rf "$ROOT_DIR/generated"
mkdir -p "$ROOT_DIR/generated"

# Generate genesis + validator keys (2 validators) using Besu operator.
docker run --rm \
  -v "$ROOT_DIR":/workspace \
  -w /workspace \
  hyperledger/besu:latest \
  operator generate-blockchain-config \
  --config-file=config/ibftConfigFile.json \
  --to=generated \
  --private-key-file-name=key

if [[ ! -f "$ROOT_DIR/generated/genesis.json" ]]; then
  echo "Expected generated/genesis.json not found." >&2
  exit 1
fi

cp "$ROOT_DIR/generated/genesis.json" "$ROOT_DIR/config/genesis.json"

echo "Generated genesis.json and validator keys under besu/generated."
