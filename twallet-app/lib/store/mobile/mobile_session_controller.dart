import 'package:get/get.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_bootstrap.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_me.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';

class MobileSessionController extends GetxController {
  final MobileApiProvider _apiProvider = Get.find();

  final Rxn<MobileMe> me = Rxn<MobileMe>();
  final Rxn<MobileBootstrap> bootstrap = Rxn<MobileBootstrap>();
  final RxBool loading = false.obs;
  final RxnString errorMessage = RxnString();

  Future<void> loadMe() async {
    loading.value = true;
    errorMessage.value = null;
    try {
      me.value = await _apiProvider.fetchMe();
    } catch (error) {
      errorMessage.value = error.toString();
    } finally {
      loading.value = false;
    }
  }

  Future<void> loadBootstrap() async {
    loading.value = true;
    errorMessage.value = null;
    try {
      bootstrap.value = await _apiProvider.fetchBootstrap();
    } catch (error) {
      errorMessage.value = error.toString();
    } finally {
      loading.value = false;
    }
  }

  bool hasRole(String role) {
    return me.value?.roles.contains(role) ?? false;
  }

  bool hasPermission(String permission) {
    return me.value?.permissions.contains(permission) ?? false;
  }

  bool get canAccessCore {
    return me.value?.platforms['core'] == true;
  }

  bool get canAccessTrading {
    return me.value?.platforms['trading'] == true;
  }
}
