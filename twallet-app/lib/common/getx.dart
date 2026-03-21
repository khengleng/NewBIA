import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:json_store/json_store.dart';
import 'package:tw_wallet_ui/common/http/http_client.dart';
import 'package:tw_wallet_ui/common/http/loading_interceptor.dart';
import 'package:tw_wallet_ui/common/secure_storage.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:tw_wallet_ui/service/progress_dialog.dart';
import 'package:tw_wallet_ui/store/identity_store.dart';
import 'package:tw_wallet_ui/store/mnemonics.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_session_controller.dart';

import '../store/web3auth_store.dart';

Future<void> initGlobalDependencies() async {
  Get.put(SecureStorage());
  Get.put(ProgressDialog());
  Get.put(LoadingInterceptor());
  Get.put(LogInterceptor(requestBody: true, responseBody: true));
  Get.put(HttpClient());
  Get.put(MobileApiProvider());
  Get.put(MobileSessionController());
  // Get.put(magicLink());
  Get.put(web3authInit());
  Get.put(
    JsonStore(dbName: identityStorageName),
    tag: identityStorageName,
  );
  await Get.putAsync(MnemonicsStore.init);
  // await Get.putAsync(MagicLinkStore.init);
  await Get.putAsync(IdentityStore.init);
}
