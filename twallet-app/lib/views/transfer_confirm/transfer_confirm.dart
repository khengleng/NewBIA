import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:tw_wallet_ui/router/routers.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:tw_wallet_ui/views/transfer_confirm/widgets/confirm_row.dart';
import 'package:tw_wallet_ui/views/transfer_confirm/widgets/input_pin.dart';
import 'package:tw_wallet_ui/views/tx_list/tx_list_details_page.dart';
import 'package:tw_wallet_ui/views/tx_list/utils/date.dart';
import 'package:tw_wallet_ui/widgets/layouts/common_layout.dart';

class TransferConfirmPage extends StatefulWidget {
  final String currency;
  final String amount;
  final String toAddress;

  const TransferConfirmPage({
    required this.currency,
    required this.amount,
    required this.toAddress,
  });

  @override
  State<StatefulWidget> createState() => TransferConfirmState();
}

class TransferConfirmState extends State<TransferConfirmPage> {
  final GlobalKey<InputPinWidgetState> inputPinWidgetKey =
      GlobalKey<InputPinWidgetState>();
  final MobileApiProvider apiProvider = Get.find();

  TransferConfirmState();

  Future<Object?> handleConfirm() async {
    final bool pinValidation =
        await inputPinWidgetKey.currentState!.validatePin();
    if (pinValidation) {
      bool transferSuccess = false;
      try {
        await apiProvider.transfer({
          'recipient': widget.toAddress,
          'amount': double.parse(widget.amount),
          'memo': 'P2P transfer'
        });
        transferSuccess = true;
      } catch (_) {
        transferSuccess = false;
      }
      if (transferSuccess && mounted) {
        // Application.router.navigateTo(context, '${Routes.transferResult}?amount=$amount&toAddress=$toAddress');
        return Navigator.pushNamed(
          context,
          Routes.txListDetails,
          arguments: TxListDetailsPageArgs(
            amount: widget.amount,
            time: parseDate(DateTime.now()),
            status: 'SUCCESS',
            type: 'WITHDRAWAL',
            description: 'P2P transfer',
            isExpense: true,
          ),
        );
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return CommonLayout(
      title: '确认转出',
      withBottomBtn: true,
      btnText: '确认转出',
      btnOnPressed: handleConfirm,
      child: SingleChildScrollView(
        child: Column(
          children: [
            ConfirmRowWidget(
              title: '金额',
              contentLeft: widget.amount,
              contentRight: widget.currency,
            ),
            ConfirmRowWidget(
              title: '接收地址',
              contentLeft: widget.toAddress,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: InputPinWidget(key: inputPinWidgetKey),
            )
          ],
        ),
      ),
    );
  }
}
