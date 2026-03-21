#!/usr/bin/env bash
set -euo pipefail

WORK_DIR=/opt/besu
OUT_DIR=$WORK_DIR/generated

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

besu operator generate-blockchain-config \
  --config-file=$WORK_DIR/ibftConfigFile.json \
  --to=$OUT_DIR \
  --private-key-file-name=key

GENESIS_PATH="$OUT_DIR/genesis.json"
if [[ ! -f "$GENESIS_PATH" ]]; then
  echo "genesis.json not found" >&2
  exit 1
fi

printf "\n===== BESU KEYGEN OUTPUT =====\n"
printf "GENESIS_JSON_BASE64=\n"
base64 < "$GENESIS_PATH"
printf "\n\nVALIDATOR_KEYS (private hex)\n"
for i in 0 1; do
  KEY_PATH="$OUT_DIR/node$i/key"
  PUB_PATH="$OUT_DIR/node$i/key.pub"
  if [[ -f "$KEY_PATH" ]]; then
    printf "validator%d_private_key=0x%s\n" "$((i+1))" "$(cat "$KEY_PATH")"
  fi
  if [[ -f "$PUB_PATH" ]]; then
    printf "validator%d_public_key=%s\n" "$((i+1))" "$(cat "$PUB_PATH")"
  fi
  printf "\n"
done

printf "NOTE: Use the validator public keys above to fill static-nodes.json and permissions_config.toml.\n"
printf "Replace <host> with the Railway internal hostnames.\n\n"
