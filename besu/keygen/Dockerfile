FROM hyperledger/besu:latest
WORKDIR /opt/besu

COPY besu/config/ibftConfigFile.json /opt/besu/ibftConfigFile.json
COPY besu/scripts/keygen.sh /opt/besu/keygen.sh

RUN chmod +x /opt/besu/keygen.sh

ENTRYPOINT ["/opt/besu/keygen.sh"]
