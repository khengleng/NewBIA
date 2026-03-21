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
  besu public-key export --node-private-key-file="$OUT_DIR/$role/key" > "$OUT_DIR/$role/key.pub" 2>/dev/null
}

# Generate extra keys for bootnode and rpc node
gen_extra_key bootnode
gen_extra_key rpc

GENESIS_PATH="$OUT_DIR/genesis.json"
if [[ ! -f "$GENESIS_PATH" ]]; then
  echo "genesis.json not found" >&2
  exit 1
fi

GENESIS_B64="$(base64 < "$GENESIS_PATH" | tr -d '\n')"

OUTPUT="===== BESU KEYGEN OUTPUT =====\n"
OUTPUT+="GENESIS_JSON_BASE64=${GENESIS_B64}\n\n"
OUTPUT+="VALIDATOR_KEYS (private hex)\n"

INDEX=1
while IFS= read -r KEY_PATH; do
  PUB_PATH="${KEY_PATH}.pub"
  if [[ -f "$KEY_PATH" ]]; then
    KEY_VALUE="$(sed 's/^0x//' "$KEY_PATH")"
    OUTPUT+="validator${INDEX}_private_key=0x${KEY_VALUE}\n"
  fi
  if [[ -f "$PUB_PATH" ]]; then
    PUB_VALUE="$(sed 's/^0x//' "$PUB_PATH")"
    OUTPUT+="validator${INDEX}_public_key=0x${PUB_VALUE}\n"
  fi
  OUTPUT+="\n"
  INDEX=$((INDEX+1))
done < <(find "$OUT_DIR/keys" -type f -name key 2>/dev/null | sort)

OUTPUT+="BOOTNODE_AND_RPC_KEYS (private hex)\n"
for ROLE in bootnode rpc; do
  KEY_PATH="$OUT_DIR/$ROLE/key"
  PUB_PATH="$OUT_DIR/$ROLE/key.pub"
  if [[ -f "$KEY_PATH" ]]; then
    KEY_VALUE="$(sed 's/^0x//' "$KEY_PATH")"
    OUTPUT+="${ROLE}_private_key=0x${KEY_VALUE}\n"
  fi
  if [[ -f "$PUB_PATH" ]]; then
    PUB_VALUE="$(sed 's/^0x//' "$PUB_PATH")"
    OUTPUT+="${ROLE}_public_key=0x${PUB_VALUE}\n"
  fi
  OUTPUT+="\n"
done

OUTPUT+="NOTE: Use the validator public keys above to fill static-nodes.json and permissions_config.toml.\n"
OUTPUT+="Replace <host> with the Railway internal hostnames.\n"

printf "%b" "$OUTPUT"
