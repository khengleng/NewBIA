import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:tw_wallet_ui/common/application.dart';
import 'package:tw_wallet_ui/router/routers.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:tw_wallet_ui/views/home/assets/home_list_item.dart';
import 'package:tw_wallet_ui/views/home/assets/home_list_view.dart';

Widget _pointItem({required String point, required BuildContext context}) {
  return GestureDetector(
    onTap: () => Navigator.pushNamed(context, Routes.txList),
    child: HomeListItem(
      leading: Text(
        Application.globalEnv.tokenName,
        style: const TextStyle(
          fontFamily: 'OpenSans',
          color: Color(0xff111111),
          fontSize: 16,
          fontWeight: FontWeight.w800,
          fontStyle: FontStyle.normal,
          letterSpacing: 0,
        ),
      ),
      trailing: Text(
        point,
        style: const TextStyle(
          fontFamily: 'PingFangSC',
          color: Color(0xff4200d4),
          fontSize: 18,
          fontWeight: FontWeight.w600,
          fontStyle: FontStyle.normal,
          letterSpacing: 0,
        ),
      ),
    ),
  );
}

class PointTab extends StatefulWidget {
  @override
  _PointTabState createState() => _PointTabState();
}

class _PointTabState extends State<PointTab> {
  final MobileApiProvider apiProvider = MobileApiProvider();
  String balanceLabel = '--';

  Future<void> _refresh() async {
    try {
      final response = await apiProvider.fetchWallet();
      final wallet = (response.data as Map<String, dynamic>?)?['wallet']
              as Map<String, dynamic>? ??
          {};
      final balance = wallet['balance']?.toString() ?? '--';
      final currency = wallet['currency']?.toString() ?? '';
      if (mounted) {
        setState(() {
          balanceLabel = '$balance $currency';
        });
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return HomeListView(
      onRefresh: _refresh,
      children: [
        _pointItem(
          point: balanceLabel,
          context: context,
        )
      ],
    );
  }
}
