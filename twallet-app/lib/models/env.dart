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
      defaultValue: 'https://trade.cambobia.com/api-proxy',
    );
    const defaultRpcUrl = String.fromEnvironment(
      'CAMBOBIA_WEB3_RPC_URL',
      defaultValue: 'https://trade.cambobia.com/api-proxy/api/mobile/chain-rpc',
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
    const defaultChainId = int.fromEnvironment('CAMBOBIA_CHAIN_ID', defaultValue: 2026);
    const defaultTokenPrecision = int.fromEnvironment('CAMBOBIA_TOKEN_PRECISION', defaultValue: 2);
    const defaultReadablePrecision = int.fromEnvironment('CAMBOBIA_TOKEN_HUMAN_PRECISION', defaultValue: 2);
    const defaultConnectTimeout = int.fromEnvironment('CAMBOBIA_API_TIMEOUT_MS', defaultValue: 30000);
    const defaultPublicKey = String.fromEnvironment(
      'CAMBOBIA_CENTRAL_BANK_PUBLIC_KEY',
      defaultValue: 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAI5SXpw1SSsM3FN43JVKn4gb+oGXfjL7rCDluqydAyHZ8vV7ySqi8oM1CoHRC9U2ST7IldydsQ+4cjC9xfzexxcCAwEAAQ==',
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
