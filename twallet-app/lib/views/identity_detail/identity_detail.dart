import 'package:flutter/cupertino.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:get/get.dart';
import 'package:tw_wallet_ui/common/application.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/models/identity/decentralized_identity.dart';
import 'package:tw_wallet_ui/router/routers.dart';
import 'package:tw_wallet_ui/store/identity_store.dart';
import 'package:tw_wallet_ui/views/identity_detail/widgets/identity_basic_info.dart';
import 'package:tw_wallet_ui/widgets/layouts/common_layout.dart';

class IdentityDetailPage extends StatelessWidget {
  final IdentityStore identityStore = Get.find();
  final String id;

  IdentityDetailPage({required this.id});

  @override
  Widget build(BuildContext context) {
    final DecentralizedIdentity? identity = identityStore.getIdentityById(id);
    return CommonLayout(
      title: identity?.profileInfo.name ?? '',
      child: Container(
        margin: const EdgeInsets.only(top: 24),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: ListView(
          children: <Widget>[
            IdentityBasicInfoWidget(id: id),
          ],
        ),
      ),
    );
  }
}
