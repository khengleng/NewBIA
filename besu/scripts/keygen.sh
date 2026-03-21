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
base64 < "$GENESIS_PATH" | tr -d '\n'
printf "\n"
printf "\n\nVALIDATOR_KEYS (private hex)\n"
INDEX=1
while IFS= read -r KEY_PATH; do
  PUB_PATH="${KEY_PATH}.pub"
  if [[ -f "$KEY_PATH" ]]; then
    KEY_VALUE="$(sed 's/^0x//' "$KEY_PATH")"
    printf "validator%d_private_key=0x%s\n" "$INDEX" "$KEY_VALUE"
  fi
  if [[ -f "$PUB_PATH" ]]; then
    PUB_VALUE="$(sed 's/^0x//' "$PUB_PATH")"
    printf "validator%d_public_key=0x%s\n" "$INDEX" "$PUB_VALUE"
  fi
  printf "\n"
  INDEX=$((INDEX+1))
done < <(find "$OUT_DIR" -type f -name key | sort)

printf "NOTE: Use the validator public keys above to fill static-nodes.json and permissions_config.toml.\n"
printf "Replace <host> with the Railway internal hostnames.\n\n"
