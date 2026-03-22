import 'package:get/get.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_bootstrap.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_me.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:tw_wallet_ui/common/secure_storage.dart';
import 'package:tw_wallet_ui/widgets/hint_dialog.dart';

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
      await _attemptPendingDidBind();
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

  Future<void> _attemptPendingDidBind() async {
    try {
      if (!Get.isRegistered<SecureStorage>()) return;
      final SecureStorage storage = Get.find<SecureStorage>();
      final pendingDid = await storage.get(SecureStorageItem.pendingDidBind);
      if (pendingDid == null || pendingDid.isEmpty) return;
      final response = await _apiProvider.bindDid(pendingDid);
      if (response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300) {
        await storage.delete(SecureStorageItem.pendingDidBind);
        showDialogSimple(DialogType.success, 'DID linked');
      }
    } catch (_) {
      // Keep pending DID for future retry.
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
