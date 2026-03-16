<<<<<<< HEAD
import 'package:cached_network_image/cached_network_image.dart';
=======
>>>>>>> origin/codex/review-source-code-3e131v
import 'package:flutter/material.dart';
import 'package:flutter_custom_dialog/flutter_custom_dialog.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/views/home/assets/home_list_item.dart';
import 'package:tw_wallet_ui/views/home/assets/home_list_view.dart';

class CertificationTab extends StatelessWidget {
  const CertificationTab({Key? key}) : super(key: key);

  void showCertification() {
    YYDialog().build()
      ..borderRadius = 4
      ..margin = const EdgeInsets.symmetric(horizontal: 24, vertical: 144)
      ..width = 1000
      ..widget(
<<<<<<< HEAD
        CachedNetworkImage(
          placeholder: (context, url) => CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(WalletColor.primary),
          ),
          imageUrl: 'https://cac-file.thoughtworks.cn/6ef1435323db384e04c2.png',
=======
        Container(
          padding: const EdgeInsets.all(24),
          color: Colors.white,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Cambobia Verification',
                style: TextStyle(
                  color: WalletColor.primary,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Certification records are managed through Cambobia platform verification services. '
                'Use the core platform or contact support for certificate validation details.',
                style: TextStyle(
                  color: Color(0xff111111),
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
            ],
          ),
>>>>>>> origin/codex/review-source-code-3e131v
        ),
      )
      ..show();
  }

  @override
  Widget build(BuildContext context) {
    return HomeListView(
      children: [
        GestureDetector(
          onTap: () => showCertification(),
          child: const HomeListItem(
            leading: Text(
              'CAC',
              style: TextStyle(
                fontFamily: 'OpenSans',
                color: Color(0xff111111),
                fontSize: 16,
                fontWeight: FontWeight.w800,
                fontStyle: FontStyle.normal,
                letterSpacing: 0,
              ),
            ),
            trailing: Text(
              '0x249f***',
              style: TextStyle(
                fontFamily: 'PingFangSC',
                color: Color(0xff4200d4),
                fontSize: 18,
                fontWeight: FontWeight.w600,
                fontStyle: FontStyle.normal,
                letterSpacing: 0,
              ),
            ),
          ),
        ),
        const HomeListItem(
          leading: Text(
            '学历证书',
            style: TextStyle(
              fontFamily: 'OpenSans',
              color: Color(0xff111111),
              fontSize: 16,
              fontWeight: FontWeight.w800,
              fontStyle: FontStyle.normal,
              letterSpacing: 0,
            ),
          ),
          trailing: Text(
            '0x707e***',
            style: TextStyle(
              fontFamily: 'PingFangSC',
              color: Color(0xff4200d4),
              fontSize: 18,
              fontWeight: FontWeight.w600,
              fontStyle: FontStyle.normal,
              letterSpacing: 0,
            ),
          ),
        )
      ],
    );
  }
}
