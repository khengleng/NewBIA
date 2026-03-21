import 'package:flutter/material.dart';
import 'package:flutter_custom_dialog/flutter_custom_dialog.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/generated/l10n.dart';
import 'package:tw_wallet_ui/service/dapp.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_session_controller.dart';
import 'package:tw_wallet_ui/views/home/assets/home_page.dart';
import 'package:tw_wallet_ui/views/home/discovery/discovery_page.dart';
import 'package:tw_wallet_ui/views/home/home_store.dart';
import 'package:tw_wallet_ui/views/home/identity/identity_page.dart';
import 'package:tw_wallet_ui/views/home/my/my_page.dart';
import 'package:tw_wallet_ui/views/mobile/mobile_dashboard_page.dart';

class Home extends StatefulWidget {
  const Home({this.defaultIndex = 0});

  final int defaultIndex;

  @override
  HomeState createState() => HomeState();
}

class HomeState extends State<Home> {
  HomeState();

  static int get identityIndex => 2;
  static final Map<String, Map<String, String>> iconPaths = {
    'home': {
      'unselected': 'assets/icons/bottom_bar/home.svg',
      'selected': 'assets/icons/bottom_bar/home_selected.svg',
    },
    'discovery': {
      'unselected': 'assets/icons/bottom_bar/discovery.svg',
      'selected': 'assets/icons/bottom_bar/discovery_selected.svg',
    },
    'identity': {
      'unselected': 'assets/icons/bottom_bar/identity.svg',
      'selected': 'assets/icons/bottom_bar/identity_selected.svg',
    },
    'me': {
      'unselected': 'assets/icons/bottom_bar/me.svg',
      'selected': 'assets/icons/bottom_bar/me_selected.svg',
    }
  };

  static SvgPicture svgIcon(String path) => SvgPicture.asset(path);

  static final List<BottomNavigationBarItem> _barItems = [
    BottomNavigationBarItem(
      icon: svgIcon(iconPaths['home']!['unselected']!),
      activeIcon: svgIcon(iconPaths['home']!['selected']!),
      label: S.current.pageHomeHome, //首页
    ),
    BottomNavigationBarItem(
      icon: svgIcon(iconPaths['discovery']!['unselected']!),
      activeIcon: svgIcon(iconPaths['discovery']!['selected']!),
      label: S.current.pageHomeDiscovery, //发现
    ),
    BottomNavigationBarItem(
      icon: svgIcon(iconPaths['identity']!['unselected']!),
      activeIcon: svgIcon(iconPaths['identity']!['selected']!),
      label: S.current.pageHomeIdentity, //身份
    ),
    BottomNavigationBarItem(
      icon: svgIcon(iconPaths['me']!['unselected']!),
      activeIcon: svgIcon(iconPaths['me']!['selected']!),
      label: S.current.pageHomeMe, //我
    ),
  ];

  final HomeStore homeStore = HomeStore();
  final MobileSessionController _session = Get.find();

  late List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    homeStore.currentPage = widget.defaultIndex;
    _session.loadMe();
    _pages = [
      HomePage(homeStore),
      DiscoveryPage(homeStore),
      IdentityPage(),
      MyPage(homeStore)
    ];
  }

  @override
  Widget build(BuildContext context) {
    DAppService.context = context;
    YYDialog.init(context);

    return Scaffold(
      backgroundColor: WalletColor.primary,
      body: Observer(builder: (_) {
        final pages = _buildPages();
        final pageIndex = _normalizeIndex(homeStore.currentPage, pages.length);
        if (pageIndex != homeStore.currentPage) {
          homeStore.currentPage = pageIndex;
        }
        return SafeArea(child: pages[pageIndex]);
      }),
      bottomNavigationBar: Observer(
        builder: (_) {
          final items = _buildBarItems();
          final pageIndex =
              _normalizeIndex(homeStore.currentPage, items.length);
          if (pageIndex != homeStore.currentPage) {
            homeStore.currentPage = pageIndex;
          }
          return BottomNavigationBar(
            items: items,
            currentIndex: pageIndex,
            type: BottomNavigationBarType.fixed,
            fixedColor: WalletColor.primary,
            selectedFontSize: 12,
            onTap: (int index) {
              homeStore.currentPage = index;
            },
          );
        },
      ),
    );
  }

  List<Widget> _buildPages() {
    if (_shouldShowMobileDashboard()) {
      return [
        HomePage(homeStore),
        const MobileDashboardPage(),
        IdentityPage(),
        MyPage(homeStore),
      ];
    }
    return _pages;
  }

  List<BottomNavigationBarItem> _buildBarItems() {
    if (_shouldShowMobileDashboard()) {
      return [
        _barItems[0],
        BottomNavigationBarItem(
          icon: svgIcon(iconPaths['discovery']!['unselected']!),
          activeIcon: svgIcon(iconPaths['discovery']!['selected']!),
          label: 'Services',
        ),
        _barItems[2],
        _barItems[3],
      ];
    }
    return _barItems;
  }

  bool _shouldShowMobileDashboard() {
    return _session.me.value != null &&
        (_session.canAccessCore ||
            _session.canAccessTrading ||
            _session.hasRole('SME_OWNER') ||
            _session.hasRole('INVESTOR') ||
            _session.hasRole('ADVISOR'));
  }

  int _normalizeIndex(int index, int length) {
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
  }
}
