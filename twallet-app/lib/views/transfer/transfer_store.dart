import 'package:mobx/mobx.dart';
import 'package:tw_wallet_ui/common/application.dart';

part 'transfer_store.g.dart';

class TransferStore = _TransferStore with _$TransferStore;

abstract class _TransferStore with Store {
  final FormErrorState error = FormErrorState();

  @observable
  String? payerAccount;

  @observable
  String? balance;

  @observable
  String? amount;

  @observable
  String? payeeAccount;

  List<ReactionDisposer>? _disposers;

  void setupErrorDisposers() {
    _disposers = [
      reaction((_) => amount, resetAmountError),
      reaction((_) => payeeAccount, resetAddressError),
    ];
  }

  void dispose() {
    for (final d in _disposers!) {
      d();
    }
  }

  void validateAll() {
    validateAmount(amount!);
    validatePayeeAccount(payeeAccount!);
  }

  @action
  void resetAmountError(String? value) {
    error.amount = null;
  }

  @action
  void resetAddressError(String? value) {
    error.payeeDID = null;
  }

  @action
  void validateAmount(String value) {
    try {
      final double res = double.parse(value);
      final int indexOfDot = value.indexOf('.');
      if (res <= 0) {
        error.amount = 'Enter an amount greater than 0';
      } else if (res > double.parse(balance!)) {
        error.amount = 'Amount exceeds your current balance';
      } else if (indexOfDot >= 0 &&
          value.length - indexOfDot >
              Application.globalEnv.tokenHumanReadablePrecision + 1) {
        error.amount =
            'Amounts support only ${Application.globalEnv.tokenHumanReadablePrecision} digits.';
      } else if (value.endsWith('.')) {
        throw Error();
      } else {
        error.amount = null;
      }
    } catch (_) {
      error.amount = 'Please enter a valid amount';
    }
  }

  @action
  void validatePayeeAccount(String value) {
    if (value.trim().isEmpty) {
      error.payeeDID = 'Please enter a valid recipient account';
      return;
    }
    if (value.trim() == payerAccount) {
      error.payeeDID =
          "The payee's account cannot be the same as the payer's account";
      return;
    }
    if (value.contains(' ')) {
      error.payeeDID = 'Please remove spaces from the account';
      return;
    }
    error.payeeDID = null;
  }
}

class FormErrorState = _FormErrorState with _$FormErrorState;

abstract class _FormErrorState with Store {
  @observable
  String? amount;

  @observable
  String? payeeDID;

  @computed
  bool get hasErrors => amount != null || payeeDID != null;
}
