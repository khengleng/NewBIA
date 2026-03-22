import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';
import 'package:crypton/crypton.dart';

part 'env.g.dart';

abstract class Env extends Object implements Built<Env, EnvBuilder> {
  static Serializer<Env> get serializer => _$envSerializer;

  String get apiGatewayBaseUrl;

  int get apiGatewayConnectTimeout;

  String get web3RpcGatewayUrl;

  String get didPrefix;

  String get tokenName;

  String get tokenSymbol;

  int get tokenPrecision;

  int get tokenHumanReadablePrecision;

  int get chainId;

  RSAPublicKey get centralBankPublicKey;

  factory Env([void Function(EnvBuilder) updates]) = _$Env;

  factory Env.fromDefault() {
    const defaultApiBaseUrl = String.fromEnvironment(
      'CAMBOBIA_API_BASE_URL',
      defaultValue: 'https://bia-trade-api-production.up.railway.app',
    );
    const defaultRpcUrl = String.fromEnvironment(
      'CAMBOBIA_WEB3_RPC_URL',
      defaultValue: 'https://bia-trade-api-production.up.railway.app/api/mobile/chain-rpc',
    );
    const defaultDidPrefix = String.fromEnvironment(
      'CAMBOBIA_DID_PREFIX',
      defaultValue: 'did:cambobia:',
    );
    const defaultTokenName = String.fromEnvironment(
      'CAMBOBIA_TOKEN_NAME',
      defaultValue: 'CamboBia Unit Token',
    );
    const defaultTokenSymbol = String.fromEnvironment(
      'CAMBOBIA_TOKEN_SYMBOL',
      defaultValue: 'CBU',
    );
    const defaultChainId = int.fromEnvironment('CAMBOBIA_CHAIN_ID', defaultValue: 20260321);
    const defaultTokenPrecision = int.fromEnvironment('CAMBOBIA_TOKEN_PRECISION', defaultValue: 2);
    const defaultReadablePrecision = int.fromEnvironment('CAMBOBIA_TOKEN_HUMAN_PRECISION', defaultValue: 2);
    const defaultConnectTimeout = int.fromEnvironment('CAMBOBIA_API_TIMEOUT_MS', defaultValue: 30000);
    const defaultPublicKey = String.fromEnvironment(
      'CAMBOBIA_CENTRAL_BANK_PUBLIC_KEY',
      defaultValue: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz44smLLhwLm5CbyHSwzpUytwabLZbT8ZMQsp8VuvNXG3YcneEsy7qkxZwbYlTRGTtHWz/EG2OWQZp2+Lzb0Oy3/kmlHh1Mo/kwLxVRA/ujJLe3FNM9SoKQ4tPonO7loNSy9ZlCgLIPoiA/JSdNynvJtkK3Exrz/AYby0mKWvIk9wtChJxszZOvtlaY+drqDq1aS6gyBTekejWaKtCs2UNhZFF5R3YJwQjMiuZYUsjM2N9XDpKbAsjmTL+IMO2YnGcJHZdmv4pC1h7x92kghBI3dAP4LidCOyTVxNLKMLreZMy86tlqQNkbnWzs+witF/la5lHrzP4yWJF0VgtxgnVQIDAQAB',
    );

    return Env(
      (builder) => builder
        ..apiGatewayBaseUrl = defaultApiBaseUrl
        ..apiGatewayConnectTimeout = defaultConnectTimeout
        ..web3RpcGatewayUrl = defaultRpcUrl
        ..didPrefix = defaultDidPrefix
        ..tokenName = defaultTokenName
        ..tokenSymbol = defaultTokenSymbol
        ..tokenPrecision = defaultTokenPrecision
        ..tokenHumanReadablePrecision = defaultReadablePrecision
        ..chainId = defaultChainId
        ..centralBankPublicKey = RSAPublicKey.fromString(defaultPublicKey),
    );
  }

  Env._();
}
