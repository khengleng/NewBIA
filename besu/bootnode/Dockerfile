FROM hyperledger/besu:24.3.1
WORKDIR /opt/besu

COPY besu/config/genesis.json /opt/besu/genesis.json
COPY besu/config/static-nodes.json /opt/besu/static-nodes.json
COPY besu/config/permissions_config.toml /opt/besu/permissions_config.toml
COPY besu/scripts/entrypoint.sh /opt/besu/entrypoint.sh

RUN chmod +x /opt/besu/entrypoint.sh

ENV BESU_ROLE=bootnode
EXPOSE 30303

ENTRYPOINT ["/opt/besu/entrypoint.sh"]
