import 'package:flutter/material.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:get/get.dart';
import 'package:tw_wallet_ui/common/application.dart';
import 'package:tw_wallet_ui/common/device_info.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/common/theme/index.dart';
import 'package:tw_wallet_ui/models/mobile/mobile_wallet_transaction.dart';
import 'package:tw_wallet_ui/router/routers.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_session_controller.dart';
import 'package:tw_wallet_ui/views/tx_list/store/tx_list_store.dart';
import 'package:tw_wallet_ui/views/tx_list/tx_list_details_page.dart';
import 'package:tw_wallet_ui/views/tx_list/utils/date.dart';
import 'package:tw_wallet_ui/views/tx_list/widgets/tx_list_item.dart';
import 'package:tw_wallet_ui/widgets/layouts/common_layout.dart';

class TxListPage extends StatefulWidget {
  const TxListPage();

  @override
  State createState() => _TxListPageState();
}

class _TxListPageState extends State<TxListPage> {
  final TxListStore store = TxListStore();
  final MobileSessionController session = Get.find();
  final MobileApiProvider apiProvider = Get.find();
  Map<String, dynamic> wallet = {};

  void _onTap(MobileWalletTransaction item) {
    final isExpense = _isExpense(item.type);
    Navigator.pushNamed(
      context,
      Routes.txListDetails,
      arguments: TxListDetailsPageArgs(
        amount: item.amount.toString(),
        time: parseDateTime(item.createdAt),
        status: item.status,
        type: item.type,
        description: item.description,
        isExpense: isExpense,
      ),
    );
  }

  @override
  void initState() {
    if (!session.hasPermission('wallet.read')) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).maybePop();
      });
      return;
    }
    store.fetchList();
    _loadWallet();
    super.initState();
  }

  Future<void> _loadWallet() async {
    try {
      final response = await apiProvider.fetchWallet();
      setState(() {
        wallet = (response.data as Map<String, dynamic>?)?['wallet']
                as Map<String, dynamic>? ??
            {};
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (!session.hasPermission('wallet.read')) {
      return CommonLayout(
        title: 'Wallet',
        child: const Center(child: Text('You do not have access to wallet history.')),
      );
    }
    return CommonLayout(
      title: 'Wallet',
      child: Observer(
        builder: (context) => Column(
          children: <Widget>[buildHeader(), buildBody(), buildFooter()],
        ),
      ),
    );
  }

  Widget buildHeader() {
    final balance = wallet['balance']?.toString() ?? '--';
    final currency = wallet['currency']?.toString() ?? '';
    return Container(
      margin: const EdgeInsets.only(top: 34),
      alignment: Alignment.center,
      child: Text(
        '$balance $currency',
        style:
            WalletFont.font_24(textStyle: TextStyle(color: WalletColor.white)),
      ),
    );
  }

  Widget buildBody() {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(top: 34),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(12),
            topRight: Radius.circular(12),
          ),
          color: WalletColor.white,
        ),
        child: buildListView(),
      ),
    );
  }

  Widget buildFooter() {
    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: DeviceInfo.isIphoneXSeries() ? 34 : 20,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Expanded(
            child: WalletTheme.button(
              text: 'Transfer',
              onPressed: () => Application.router
                  .navigateTo(context, Routes.transferTwPoints),
              buttonType: ButtonType.outlineType,
              outlineColor: WalletColor.white,
            ),
          ),
          const SizedBox(
            width: 15,
          ),
          Expanded(
            child: WalletTheme.button(
              text: 'Recieve',
              onPressed: () => Navigator.pushNamed(
                context,
                Routes.qrPage,
                arguments: {
                  'name': session.me.value?.user.email ?? 'User',
                  'account': session.me.value?.user.email ??
                      session.me.value?.user.id ??
                      '',
                },
              ),
              buttonType: ButtonType.outlineType,
              outlineColor: WalletColor.white,
            ),
          )
        ],
      ),
    );
  }

  bool _isExpense(String type) {
    switch (type) {
      case 'WITHDRAWAL':
      case 'TRADE_BUY':
      case 'FEE':
        return true;
      default:
        return false;
    }
  }

  Widget buildListView() {
    final txList = store.list;

    if (txList.isEmpty) {
      return const Center(child: Text("no content"));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(8),
      itemCount: txList.length,
      itemBuilder: (BuildContext context, int index) {
        final item = txList[index];
        return TxListItem(
          item.type,
          _amountWithSignal(_isExpense(item.type), item.amount),
          item.status,
          item.createdAt,
          () => _onTap(item),
        );
      },
      separatorBuilder: (BuildContext context, int index) => Divider(
        height: 1,
        color: WalletColor.grey,
      ),
    );
  }

  String _amountWithSignal(bool isExpense, double amount) {
    final sign = isExpense ? '-' : '+';
    return '$sign${amount.toString()}';
  }
}
