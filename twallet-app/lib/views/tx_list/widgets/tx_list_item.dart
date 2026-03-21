import 'package:flutter/material.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/views/tx_list/utils/date.dart';

class TxListItem extends StatelessWidget {
  static const _greyColor = 0xFF888888;

  final String _title;
  final String _amountLabel;
  final String _status;
  final DateTime _dateTime;
  final GestureTapCallback _onTap;

  const TxListItem(
    this._title,
    this._amountLabel,
    this._status,
    this._dateTime,
    this._onTap,
  );

  Widget _renderDate() => Text(
        parseDate(_dateTime),
        style: const TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 10.7,
          color: Color(_greyColor),
        ),
      );

  Widget _renderTitle() => Text(_title, style: WalletFont.font_16());

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 22),
        child: Column(
          children: <Widget>[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[_renderDate()],
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                _renderTitle(),
                Text(_amountLabel, style: WalletFont.font_16()),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
