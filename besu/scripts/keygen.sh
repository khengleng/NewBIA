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

gen_extra_key() {
  local role=$1
  mkdir -p "$OUT_DIR/$role"
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$OUT_DIR/$role/key"
  besu public-key export --node-private-key-file="$OUT_DIR/$role/key" > "$OUT_DIR/$role/key.pub"
}

# Generate extra keys for bootnode and rpc node
gen_extra_key bootnode
gen_extra_key rpc

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
done < <(find "$OUT_DIR/keys" -type f -name key 2>/dev/null | sort)

printf "\nBOOTNODE_AND_RPC_KEYS (private hex)\n"
for ROLE in bootnode rpc; do
  KEY_PATH="$OUT_DIR/$ROLE/key"
  PUB_PATH="$OUT_DIR/$ROLE/key.pub"
  if [[ -f "$KEY_PATH" ]]; then
    KEY_VALUE="$(sed 's/^0x//' "$KEY_PATH")"
    printf "%s_private_key=0x%s\n" "$ROLE" "$KEY_VALUE"
  fi
  if [[ -f "$PUB_PATH" ]]; then
    PUB_VALUE="$(sed 's/^0x//' "$PUB_PATH")"
    printf "%s_public_key=0x%s\n" "$ROLE" "$PUB_VALUE"
  fi
  printf "\n"
done

printf "NOTE: Use the validator public keys above to fill static-nodes.json and permissions_config.toml.\n"
printf "Replace <host> with the Railway internal hostnames.\n\n"
