import 'package:get/get.dart';
import 'package:mobx/mobx.dart';
import 'package:tw_wallet_ui/common/util.dart';
import 'package:tw_wallet_ui/models/identity/decentralized_identity.dart';
import 'package:tw_wallet_ui/store/account_store.dart';
import 'package:tw_wallet_ui/store/identity_store.dart';
import 'package:tw_wallet_ui/store/mnemonics.dart';
import 'package:tw_wallet_ui/store/web3auth_store.dart';
import 'package:tw_wallet_ui/views/home/identity/date_validator.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:uuid/uuid.dart';
import 'package:validators/validators.dart';

part 'identity_new_store.g.dart';

class IdentityNewStore = _IdentityNewStore with _$IdentityNewStore;

abstract class _IdentityNewStore with Store {
  final FormErrorState error = FormErrorState();
  final IdentityStore _identityStore = Get.find();

  @observable
  String name = '';

  @observable
  String phone = '';

  @observable
  String email = '';

  @observable
  String birthday = '';

  List<ReactionDisposer>? _disposers;

  void setErrorResetDispatchers() {
    _disposers = [
      reaction((_) => name, resetNameError),
      reaction((_) => phone, resetPhoneError),
      reaction((_) => email, resetEmailError),
      reaction((_) => birthday, resetBirthdayError),
    ];
  }

  void dispose() {
    for (final d in _disposers!) {
      d();
    }
  }

  void validateAll() {
    validateUsername(name);
    validatePhone(phone);
    validateEmail(email);
    validateBirthday(birthday);
  }

  @action
  void clearError() {
    error.username = null;
    error.phone = null;
    error.email = null;
    error.birthday = null;
  }

  @action
  void resetNameError(String value) {
    error.username = null;
  }

  @action
  void resetPhoneError(String value) {
    error.phone = null;
  }

  @action
  void resetEmailError(String value) {
    error.email = null;
  }

  @action
  void resetBirthdayError(String value) {
    error.birthday = null;
  }

  void validateUsername(String value) {
    if (isNull(value) || value.isEmpty) {
      error.username = 'Required';
    } else if (_identityStore.identities
        .any((identity) => identity.profileInfo.name == value)) {
      error.username = 'Name already exists';
    } else {
      error.username = null;
    }
  }

  void validatePhone(String value) {
    error.phone = value.isNotEmpty
        ? Util.isValidPhone(phone)
            ? null
            : 'Invalid phone number'
        : null;
  }

  void validateEmail(String value) {
    error.email = value.isNotEmpty
        ? isEmail(value)
            ? null
            : 'Invalid email'
        : null;
  }

  void validateBirthday(String value) {
    error.birthday = value.isNotEmpty
        ? isValidDate(value)
            ? null
            : 'Invalid date'
        : null;
  }

  @action
  Future<dynamic> addIdentity() async {
    AccountStore store;
    if (Get.isRegistered<Web3authStore>()) {
      store = Get.find<Web3authStore>();
    } else {
      store = Get.find<MnemonicsStore>();
    }

    if (!error.hasErrors) {
      return store.accountInfo
          .then(
        (accountInfo) => DecentralizedIdentity(
          (identity) => identity
            ..id = const Uuid().v1()
            ..profileInfo.name = name
            ..accountInfo.index = accountInfo.index
            ..accountInfo.pubKey = accountInfo.pubKey
            ..accountInfo.priKey = accountInfo.priKey
            ..accountInfo.address = accountInfo.address
            ..profileInfo.phone = phone
            ..profileInfo.email = email
            ..profileInfo.birthday = birthday,
        ),
      )
          .then((identity) {
        return identity.register(store.credentials).then((success) async {
          if (success) {
            await _bindDidIfPossible(identity);
          }
          return success;
        });
      });
    }
    return false;
  }
}

Future<void> _bindDidIfPossible(DecentralizedIdentity identity) async {
  try {
    if (Get.isRegistered<MobileApiProvider>()) {
      final MobileApiProvider api = Get.find<MobileApiProvider>();
      await api.bindDid(identity.did.toString());
    }
  } catch (_) {
    // Ignore bind failures for now (e.g., not logged in or offline).
  }
}

class FormErrorState = _FormErrorState with _$FormErrorState;

abstract class _FormErrorState with Store {
  @observable
  String? username;

  @observable
  String? phone;

  @observable
  String? email;

  @observable
  String? birthday;

  @computed
  bool get hasErrors =>
      username != null || phone != null || email != null || birthday != null;
}
