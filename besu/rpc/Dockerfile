FROM hyperledger/besu:latest
WORKDIR /opt/besu

COPY besu/config/genesis.json /opt/besu/genesis.json
COPY besu/config/static-nodes.json /opt/besu/static-nodes.json
COPY besu/config/permissions_config.toml /opt/besu/permissions_config.toml
COPY besu/scripts/entrypoint.sh /opt/besu/entrypoint.sh

RUN chmod +x /opt/besu/entrypoint.sh

ENV BESU_ROLE=rpc
EXPOSE 30303 8545

ENTRYPOINT ["/opt/besu/entrypoint.sh"]
