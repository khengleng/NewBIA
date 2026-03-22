import 'dart:async';

import 'package:encrypt/encrypt.dart' as encrypt_tool;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import 'package:tw_wallet_ui/common/secure_storage.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/common/theme/index.dart';
import 'package:tw_wallet_ui/models/webview/pincode_dialog/pincode_dialog_error_msg.dart';
import 'package:tw_wallet_ui/models/webview/pincode_dialog/pincode_dialog_input.dart';
import 'package:tw_wallet_ui/service/pincode.dart';
import 'package:tw_wallet_ui/widgets/error_row.dart';

class InputPinWidget extends StatefulWidget {
  final bool autoValidate;
  final WebviewPincodeDialogInput? pincodeDialogInput;
  final WebviewPincodeDialogErrorMsg? pincodeDialogErrorMsg;
  final Function? onValidateSuccess;
  final Completer? completer;

  const InputPinWidget({
    required Key key,
    this.autoValidate = false,
    this.pincodeDialogInput,
    this.pincodeDialogErrorMsg,
    this.onValidateSuccess,
    this.completer,
  }) : super(key: key);

  @override
  State<StatefulWidget> createState() {
    return InputPinWidgetState();
  }
}

class InputPinWidgetState extends State<InputPinWidget> {
  String pinValue = '';
  bool showErrorMsg = false;

  Future<bool> validatePin() async {
    final iv = encrypt_tool.IV.fromUtf8('${pinValue}0123456789');
    final encrypt_tool.Key aesKey =
        encrypt_tool.Key.fromUtf8('${pinValue}abcdefghijklmnopqrstuvwxyz');
    final encrypt = encrypt_tool.Encrypter(
      encrypt_tool.AES(aesKey, mode: encrypt_tool.AESMode.cbc),
    );
    final String? encryptedString =
        await Get.find<SecureStorage>().get(SecureStorageItem.masterKey);
    final encrypt_tool.Encrypted encryptedKey =
        encrypt_tool.Encrypted.fromBase64(encryptedString!);
    try {
      encrypt.decrypt(encryptedKey, iv: iv);
      if (widget.completer != null) {
        widget.completer!.complete(PincodeService.createToken());
      }
      return true;
    } catch (error) {
      setState(() {
        showErrorMsg = true;
      });
      return false;
    }
  }

  void onChanged(String value) {
    if (showErrorMsg) {
      showErrorMsg = false;
    }
    setState(() {
      pinValue = value;
    });
  }

  void handlePinComplete(String pincode) {
    if (!widget.autoValidate) {
      return;
    }
    validatePin();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        SizedBox(
          width: double.infinity,
          child: MaterialPinField(
            pinController: PinInputController(text: pinValue),
            length: 6,
            obscureText: true,
            theme: MaterialPinTheme(
              shape: MaterialPinShape.outlined,
              borderWidth: widget.pincodeDialogInput?.borderWidth ?? 1,
              borderRadius: BorderRadius.all(
                Radius.circular(
                  widget.pincodeDialogInput?.borderRadius ?? 8,
                ),
              ),
              cellSize: Size(
                widget.pincodeDialogInput?.size ?? 40,
                widget.pincodeDialogInput?.size ?? 40,
              ),
              borderColor: WalletTheme.rgbColor(
                widget.pincodeDialogInput?.borderColor ?? WalletColor.BLACK,
              ),
              focusedBorderColor: WalletTheme.rgbColor(
                widget.pincodeDialogInput?.activeBorderColor ??
                    WalletColor.PRIMARY,
              ),
              filledBorderColor: WalletTheme.rgbColor(
                widget.pincodeDialogInput?.selectedBorderColor ??
                    WalletColor.PRIMARY,
              ),
              fillColor: WalletTheme.rgbColor(
                widget.pincodeDialogInput?.filledColor ?? WalletColor.WHITE,
              ),
              focusedFillColor: WalletTheme.rgbColor(
                widget.pincodeDialogInput?.activeFillColor ?? WalletColor.WHITE,
              ),
              filledFillColor: WalletTheme.rgbColor(
                widget.pincodeDialogInput?.selectedFillColor ??
                    WalletColor.PRIMARY,
              ),
              textStyle: WalletFont.font_16(
                textStyle: TextStyle(
                  color: WalletTheme.rgbColor(
                    widget.pincodeDialogInput?.textColor ?? WalletColor.BLACK,
                  ),
                  fontSize: widget.pincodeDialogInput?.textSize ?? 16,
                ),
              ),
              entryAnimation: MaterialPinAnimation.fade,
              animationDuration: const Duration(milliseconds: 300),
              showCursor: false,
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: onChanged,
            onCompleted: handlePinComplete,
          ),
        ),
        if (showErrorMsg)
          ErrorRowWidget(
            errorText: 'PIN code is incorrect, please re-enter',
            pincodeDialogErrorMsg: widget.pincodeDialogErrorMsg,
          )
      ],
    );
  }
}
