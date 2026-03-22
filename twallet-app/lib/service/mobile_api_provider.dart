import 'package:dio/dio.dart';
import 'package:get/get.dart' as g;
import 'package:tw_wallet_ui/common/http/http_client.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_bootstrap.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_me.dart';

class MobileApiProvider {
  final HttpClient _httpClient = g.Get.find();

  Future<Response> login(String email, String password) {
    return _httpClient.post(
      '/api/mobile/auth/login',
      {'email': email, 'password': password},
      throwError: true,
    );
  }

  Future<Response> refresh(String refreshToken) {
    return _httpClient.post(
      '/api/mobile/auth/refresh',
      {'refreshToken': refreshToken},
      throwError: true,
    );
  }

  Future<Response> logout(String refreshToken) {
    return _httpClient.post(
      '/api/mobile/auth/logout',
      {'refreshToken': refreshToken},
      throwError: true,
    );
  }

  Future<MobileMe> fetchMe() {
    return _httpClient
        .get('/api/mobile/me', throwError: true)
        .then((response) => MobileMe.fromJson(response.data as Map<String, dynamic>));
  }

  Future<MobileBootstrap> fetchBootstrap() {
    return _httpClient
        .get('/api/mobile/bootstrap', throwError: true)
        .then((response) => MobileBootstrap.fromJson(response.data as Map<String, dynamic>));
  }

  Future<Response> fetchWallet() {
    return _httpClient.get('/api/mobile/wallet', throwError: true);
  }

  Future<Response> fetchWalletHistory({Map<String, dynamic>? query}) {
    final params = query ?? const {};
    final queryString = params.entries
        .map((entry) => '${Uri.encodeQueryComponent(entry.key)}=${Uri.encodeQueryComponent(entry.value.toString())}')
        .join('&');
    final suffix = queryString.isEmpty ? '' : '?$queryString';
    return _httpClient.get('/api/mobile/wallet/history$suffix', throwError: true);
  }

  Future<Response> deposit(Map<String, dynamic> payload) {
    return _httpClient.post('/api/mobile/wallet/deposit', payload, throwError: true);
  }

  Future<Response> withdraw(Map<String, dynamic> payload) {
    return _httpClient.post('/api/mobile/wallet/withdraw', payload, throwError: true);
  }

  Future<Response> transfer(Map<String, dynamic> payload) {
    return _httpClient.post('/api/mobile/wallet/transfer', payload, throwError: true);
  }

  Future<Response> fetchDeals({String? platform}) {
    final query = platform == null || platform.isEmpty
        ? ''
        : '?platform=${Uri.encodeQueryComponent(platform)}';
    return _httpClient.get('/api/mobile/deals$query', throwError: true);
  }

  Future<Response> fetchListings({Map<String, dynamic>? query}) {
    final params = query ?? const {};
    final queryString = params.entries
        .map((entry) => '${Uri.encodeQueryComponent(entry.key)}=${Uri.encodeQueryComponent(entry.value.toString())}')
        .join('&');
    final suffix = queryString.isEmpty ? '' : '?$queryString';
    return _httpClient.get('/api/mobile/secondary-trading/listings$suffix', throwError: true);
  }

  Future<Response> fetchConversations() {
    return _httpClient.get('/api/mobile/messages/conversations', throwError: true);
  }

  Future<Response> fetchConversation(String conversationId) {
    return _httpClient.get(
      '/api/mobile/messages/conversations/${Uri.encodeComponent(conversationId)}',
      throwError: true,
    );
  }

  Future<Response> sendMessage(Map<String, dynamic> payload) {
    return _httpClient.post('/api/mobile/messages', payload, throwError: true);
  }

  Future<Response> startConversation(Map<String, dynamic> payload) {
    return _httpClient.post('/api/mobile/messages/start', payload, throwError: true);
  }

  Future<Response> fetchAbaStatus(String transactionId) {
    return _httpClient.get(
      '/api/mobile/funding/aba/status/${Uri.encodeComponent(transactionId)}',
      throwError: true,
    );
  }

  Future<Response> fetchPortfolio() {
    return _httpClient.get('/api/mobile/portfolio', throwError: true);
  }

  Future<Response> fetchWalletAddress() {
    return _httpClient.get('/api/mobile/wallet/address', throwError: true);
  }

  Future<Response> updateWalletAddress(Map<String, dynamic> payload) {
    return _httpClient.post('/api/mobile/wallet/address', payload, throwError: true);
  }
}
