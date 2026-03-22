import 'package:get/get.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_session_controller.dart';

class MobileDashboardStore extends GetxController {
  final MobileApiProvider _apiProvider = Get.find();
  final MobileSessionController _session = Get.find();

  final RxBool loading = false.obs;
  final RxnString errorMessage = RxnString();

  final Rxn<Map<String, dynamic>> wallet = Rxn<Map<String, dynamic>>();
  final RxList<dynamic> transactions = <dynamic>[].obs;
  final RxList<dynamic> deals = <dynamic>[].obs;
  final RxList<dynamic> listings = <dynamic>[].obs;
  final RxList<dynamic> portfolioItems = <dynamic>[].obs;
  final RxnString walletAddress = RxnString();

  Future<void> loadAll() async {
    loading.value = true;
    errorMessage.value = null;
    try {
      if (_session.me.value == null) {
        await _session.loadMe();
      }

      if (_session.me.value != null) {
        final bootstrap = await _apiProvider.fetchBootstrap();
        wallet.value = bootstrap.wallet;
        transactions.assignAll(bootstrap.transactions);
      }

      if (_session.hasPermission('deal.list')) {
        final primaryRole = _session.me.value?.primaryRole ?? '';
        final platform = primaryRole == 'INVESTOR' ? 'trading' : 'core';
        final response = await _apiProvider.fetchDeals(platform: platform);
        final data = response.data as Map<String, dynamic>? ?? const {};
        deals.assignAll((data['deals'] as List<dynamic>? ?? data['items'] as List<dynamic>? ?? const []));
      }

      if (_session.hasPermission('secondary_trading.list')) {
        final response = await _apiProvider.fetchListings();
        final data = response.data as Map<String, dynamic>? ?? const {};
        listings.assignAll((data['listings'] as List<dynamic>? ?? data['items'] as List<dynamic>? ?? const []));
      }

      if (_session.hasPermission('deal.list')) {
        final response = await _apiProvider.fetchPortfolio();
        final data = response.data as Map<String, dynamic>? ?? const {};
        portfolioItems.assignAll(data['items'] as List<dynamic>? ?? const []);
        final walletAddressValue = data['walletAddress']?.toString();
        if (walletAddressValue != null && walletAddressValue.isNotEmpty) {
          walletAddress.value = walletAddressValue;
        }
      }
    } catch (error) {
      errorMessage.value = error.toString();
    } finally {
      loading.value = false;
    }
  }
}
