import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:tw_wallet_ui/common/dapp_list.dart';
import 'package:tw_wallet_ui/common/device_info.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/models/webview/webview_request.dart';
import 'package:tw_wallet_ui/service/dapp.dart';
import 'package:tw_wallet_ui/service/mobile_api_provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

class DAppPage extends StatefulWidget {
  final String id;
  const DAppPage({required this.id});

  @override
  State<StatefulWidget> createState() {
    return DAppPageState();
  }
}

class DAppPageState extends State<DAppPage> {
  late final WebViewController _controller;
  bool isLoadingPage = true;
  Color backgroundColor = Colors.white;

  @override
  void initState() {
    super.initState();
    DAppService.dappPageStateInstance = this;
    DAppService.setStatusBarMode('id', 'dark');

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..addJavaScriptChannel(
        'TWalletNative',
        onMessageReceived: (JavaScriptMessage message) {
          try {
            final Map<String, dynamic>? requestJson =
                jsonDecode(message.message) as Map<String, dynamic>?;
            final WebviewRequest webviewRequest =
                WebviewRequest.fromJson(requestJson);
            DAppService.getOperator(webviewRequest.method)
                .call(webviewRequest.id, webviewRequest.param);
          } catch (e) {
            _controller.runJavaScript(
              'window.TWallet.rejectPromise(${json.encode(json.encode(e.toString()))});',
            );
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            _controller.runJavaScript(
              'window._wallet_dapp_id = ${json.encode(widget.id)}',
            );
          },
          onPageFinished: (String url) {
            finishLoading();
          },
        ),
      )
      ..loadRequest(Uri.parse('about:blank'));

    DAppService.webviewController = _controller;
    DAppService.dappid = widget.id;

    _loadInitialUrl();
  }

  DAppInfo getDappById(String? id) {
    return dappList.firstWhere((dapp) => dapp.id == id);
  }

  Future<void> _loadInitialUrl() async {
    final dapp = getDappById(widget.id);
    var url = dapp.url;
    if (dapp.id == 'cambobia-trade') {
      try {
        if (Get.isRegistered<MobileApiProvider>()) {
          final api = Get.find<MobileApiProvider>();
          url = await api.fetchTradingSsoLink(next: '/dashboard');
        }
      } catch (_) {
        // Fall back to the raw trading URL if SSO fails.
        url = dapp.url;
      }
    }

    await _controller.loadRequest(Uri.parse(url));
  }

  Future<bool> onBack() async {
    _controller.runJavaScript('window.TWallet.emit("BACK");');
    return false;
  }

  void finishLoading() {
    setState(() {
      isLoadingPage = false;
    });
  }

  void changeBackgroundColor(Color color) {
    setState(() {
      backgroundColor = color;
    });
  }

  void resetToAppStatusBar() {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: WalletColor.primary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: onBack,
      child: Scaffold(
        backgroundColor: backgroundColor,
        bottomNavigationBar: Theme(
          data: Theme.of(context),
          child: Container(
            height: DeviceInfo.isIphoneXSeries() ? 34 : 0,
            color: WalletColor.white,
          ),
        ),
        body: SafeArea(
          child: Stack(
            children: <Widget>[
              WebViewWidget(controller: _controller),
              if (isLoadingPage)
                Container(
                  alignment: FractionalOffset.center,
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(
                      WalletColor.primary,
                    ),
                  ),
                )
            ],
          ),
        ),
      ),
    );
  }
}
