import 'package:mobx/mobx.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_wallet_transaction.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';

part 'tx_list_store.g.dart';

class TxListStore = _TxListStore with _$TxListStore;

abstract class _TxListStore with Store {
  final MobileApiProvider _client = MobileApiProvider();

  @observable
  ObservableFuture<List<MobileWalletTransaction>> listFuture =
      ObservableFuture.value(<MobileWalletTransaction>[]);

  @observable
  late ObservableFuture<MobileWalletTransaction?> tx;

  @observable
  List<MobileWalletTransaction> list = [];

  @observable
  String? errorMessage = '';

  @computed
  bool get loading => listFuture.status == FutureStatus.pending;

  @action
  Future fetchList({int limit = 50, int offset = 0}) async {
    final future = _client
        .fetchWalletHistory(query: {'limit': limit, 'offset': offset})
        .then((response) {
      final data = response.data as Map<String, dynamic>? ?? const {};
      final items = (data['transactions'] as List<dynamic>? ?? const []);
      return items
          .whereType<Map<String, dynamic>>()
          .map(MobileWalletTransaction.fromJson)
          .toList();
    });

    listFuture = ObservableFuture(future);

    try {
      list = await future;
    } catch (e) {
      errorMessage = e.toString();
    }
  }

  @action
  Future fetchDetails(String id) async {
    tx = ObservableFuture(
      Future.value(list.firstWhere((item) => item.id == id, orElse: () => null)),
    );
  }
}
