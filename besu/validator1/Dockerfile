FROM hyperledger/besu:latest
WORKDIR /opt/besu

COPY config/genesis.json /opt/besu/genesis.json
COPY config/static-nodes.json /opt/besu/static-nodes.json
COPY config/permissions_config.toml /opt/besu/permissions_config.toml
COPY scripts/entrypoint.sh /opt/besu/entrypoint.sh

RUN chmod +x /opt/besu/entrypoint.sh

ENV BESU_ROLE=validator
EXPOSE 30303

ENTRYPOINT ["/opt/besu/entrypoint.sh"]
