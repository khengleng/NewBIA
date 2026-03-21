import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/common/theme/index.dart';
import 'package:tw_wallet_ui/router/routers.dart';
import 'package:tw_wallet_ui/widgets/layouts/common_layout.dart';
import 'package:tw_wallet_ui/widgets/page_title.dart';

class TxListDetailsPageArgs {
  final String amount;
  final String time;
  final String status;
  final String type;
  final String? description;
  final bool isExpense;
  final bool shouldBackToHome;

  TxListDetailsPageArgs({
    required this.amount,
    required this.isExpense,
    required this.time,
    required this.status,
    required this.type,
    required this.description,
    this.shouldBackToHome = false,
  });
}

class TxListDetailsPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final TxListDetailsPageArgs args =
        ModalRoute.of(context)!.settings.arguments! as TxListDetailsPageArgs;

    return WillPopScope(
      onWillPop: args.shouldBackToHome ? () async => false : null,
      child: CommonLayout(
        title: 'Transactionn Details',
        backIcon: args.shouldBackToHome ? BackIcon.none : BackIcon.arrow,
        child: _buildMainContent(context, args),
      ),
    );
  }

  Container _buildMainContent(
    BuildContext context,
    TxListDetailsPageArgs args,
  ) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: ListView(
        children: <Widget>[
          _buildStatusCard(args),
          _buildTXInfoCard(args),
          if (args.shouldBackToHome) _buildButton(context, args)
        ],
      ),
    );
  }

  Widget _buildStatusCard(TxListDetailsPageArgs args) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.all(Radius.circular(12)),
        color: WalletColor.white,
      ),
      child: Column(
        children: <Widget>[
          Text(
            '${args.isExpense ? '-' : '+'}${args.amount}',
            style: WalletFont.font_24(),
          ),
          Container(
            height: 1,
            color: WalletColor.middleGrey,
            margin: const EdgeInsets.only(top: 30, bottom: 24),
          ),
          Text('- ${args.status} -', style: WalletFont.font_16()),
          Container(
            margin: const EdgeInsets.only(top: 14),
            child: Text(
              args.type,
              style: WalletFont.font_14(),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildTXInfoCard(TxListDetailsPageArgs args) {
    return Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.all(Radius.circular(12)),
        color: WalletColor.white,
      ),
      child: Column(
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Container(
                margin: const EdgeInsets.only(right: 30),
                child: Text(
                  'Transaction Time',
                  style: WalletFont.font_14(
                    textStyle: TextStyle(color: WalletColor.grey),
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  args.time,
                  style: WalletFont.font_14(
                    textStyle: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  textAlign: TextAlign.right,
                ),
              )
            ],
          ),
          Container(
            height: 1,
            color: WalletColor.middleGrey,
            margin: const EdgeInsets.symmetric(vertical: 20),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                'Description',
                style: WalletFont.font_14(
                  textStyle: TextStyle(color: WalletColor.grey),
                ),
              ),
              Expanded(
                child: Text(
                  args.description ?? 'N/A',
                  style: WalletFont.font_14(
                    textStyle: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  textAlign: TextAlign.right,
                ),
              )
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildButton(BuildContext context, TxListDetailsPageArgs args) {
    return Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0f000000),
            offset: Offset(0, 4),
            blurRadius: 12,
          )
        ],
        color: WalletColor.white,
      ),
      child: WalletTheme.button(
        text: 'OK',
        onPressed: () {
          Navigator.popUntil(
            context,
            (Route<dynamic> route) =>
                route.settings.name?.startsWith(Routes.home) ?? false,
          );
        },
      ),
    );
  }
}
