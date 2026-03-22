import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/models/identity/decentralized_identity.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_session_controller.dart';
import 'package:get/get.dart';
import 'package:tw_wallet_ui/widgets/avatar.dart';
import 'package:tw_wallet_ui/widgets/layouts/common_layout.dart';

class IdentityQRPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)!.settings.arguments;

    return CommonLayout(
      title: 'My QR Code',
      child: _buildMainContent(args),
    );
  }

  Widget _buildMainContent(dynamic args) {
    final session = Get.find<MobileSessionController>();
    String displayName = 'User';
    String account = '';

    if (args is DecentralizedIdentity) {
      displayName = args.profileInfo.name;
      account = args.did.toString();
    } else if (args is Map) {
      displayName = (args['name'] ?? 'User').toString();
      account = (args['account'] ?? '').toString();
    } else {
      displayName = session.me.value?.user.email ?? 'User';
      account = session.me.value?.user.email ??
          session.me.value?.user.id ??
          '';
    }

    return Container(
      margin: const EdgeInsets.only(top: 15),
      child: ListView(
        children: <Widget>[
          Stack(
            children: <Widget>[
              Container(
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.all(Radius.circular(12)),
                  color: WalletColor.white,
                ),
                margin: const EdgeInsets.only(left: 18, right: 18, top: 40),
                padding: const EdgeInsets.only(
                  top: 74,
                  bottom: 41,
                  left: 60,
                  right: 60,
                ),
                child: Column(
                  children: <Widget>[
                    Text(
                      displayName,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    _buildQRCode(account),
                    Container(
                      height: 1,
                      margin: const EdgeInsets.only(top: 60, bottom: 40),
                      color: WalletColor.middleGrey,
                    ),
                    Text(
                      account,
                      style: WalletFont.font_14(),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              const Positioned(
                child: Align(child: AvatarWidget()),
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildQRCode(String did) {
    return Container(
      margin: const EdgeInsets.only(top: 30),
      child: QrImageView(
        data: did,
      ),
    );
  }
}
