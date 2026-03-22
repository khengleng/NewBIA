import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_dashboard_store.dart';
import 'package:tw_wallet_ui/store/mobile/mobile_session_controller.dart';

class MobileDashboardPage extends StatefulWidget {
  const MobileDashboardPage({super.key});

  @override
  State<MobileDashboardPage> createState() => _MobileDashboardPageState();
}

class _MobileDashboardPageState extends State<MobileDashboardPage> {
  final MobileDashboardStore _store = Get.put(MobileDashboardStore());
  final MobileSessionController _session = Get.find();

  @override
  void initState() {
    super.initState();
    _store.loadAll();
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (_store.loading.value) {
        return const Center(child: CircularProgressIndicator());
      }

      if (_store.errorMessage.value != null) {
        return Center(child: Text(_store.errorMessage.value!));
      }

      return ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          _sectionHeader('Account'),
          _buildRoleSummary(),
          const SizedBox(height: 16),
          if (_session.hasPermission('wallet.read')) _buildWalletSummary(),
          if (_session.hasPermission('deal.list')) _buildDealsSection(),
          if (_session.hasPermission('deal.list')) _buildTokenizedAssetsSection(),
          if (_session.hasPermission('secondary_trading.list'))
            _buildListingsSection(),
          if (!_session.hasPermission('wallet.read') &&
              !_session.hasPermission('deal.list') &&
              !_session.hasPermission('secondary_trading.list'))
            _buildNoAccessNotice(),
        ],
      );
    });
  }

  Widget _sectionHeader(String title) {
    return Text(
      title,
      style: WalletFont.font_18(
        textStyle: TextStyle(
          color: WalletColor.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildRoleSummary() {
    final roles = _session.me.value?.roles ?? const [];
    final platforms = _session.me.value?.platforms ?? const {};
    final paymentMode = _session.me.value?.paymentMode ?? 'P2P_C2B_C2C';
    return Card(
      elevation: 0,
      color: WalletColor.backgroundWhite,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Roles: ${roles.isEmpty ? "None" : roles.join(", ")}'),
            const SizedBox(height: 6),
            Text('Core: ${platforms['core'] == true ? "Enabled" : "Disabled"}'),
            Text(
              'Trading: ${platforms['trading'] == true ? "Enabled" : "Disabled"}',
            ),
            const SizedBox(height: 6),
            Text('Payment Mode: $paymentMode'),
          ],
        ),
      ),
    );
  }

  Widget _buildWalletSummary() {
    final wallet = _store.wallet.value ?? const {};
    final balance = wallet['balance']?.toString() ?? '--';
    final currency = wallet['currency']?.toString() ?? '';
    final txCount = _store.transactions.length;
    return Card(
      elevation: 0,
      color: WalletColor.backgroundWhite,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader('Wallet'),
            const SizedBox(height: 8),
            Text('Balance: $balance $currency'),
            Text('Recent transactions: $txCount'),
          ],
        ),
      ),
    );
  }

  Widget _buildDealsSection() {
    return Card(
      elevation: 0,
      color: WalletColor.backgroundWhite,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader('Deals'),
            const SizedBox(height: 8),
            _buildListPreview(_store.deals),
          ],
        ),
      ),
    );
  }

  Widget _buildTokenizedAssetsSection() {
    final items = _store.portfolioItems
        .where((item) =>
            item is Map<String, dynamic> &&
            (item['tokenContractAddress'] != null))
        .toList();

    return Card(
      elevation: 0,
      color: WalletColor.backgroundWhite,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader('Tokenized Assets'),
            const SizedBox(height: 8),
            if (items.isEmpty) const Text('No on-chain assets yet.'),
            if (items.isNotEmpty)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: items.take(3).map((item) {
                  final map = item as Map<String, dynamic>;
                  final name = map['name']?.toString() ?? 'Asset';
                  final symbol = map['tokenSymbol']?.toString() ?? '';
                  final balance = map['onchainBalance']?.toString();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      balance == null
                          ? '- $name $symbol'
                          : '- $name $symbol (On-chain: $balance)',
                    ),
                  );
                }).toList(),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildListingsSection() {
    return Card(
      elevation: 0,
      color: WalletColor.backgroundWhite,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader('Listings'),
            const SizedBox(height: 8),
            _buildListPreview(_store.listings),
          ],
        ),
      ),
    );
  }

  Widget _buildListPreview(List<dynamic> items) {
    if (items.isEmpty) {
      return const Text('No items available');
    }

    final preview = items.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: preview.map((item) {
        if (item is Map<String, dynamic>) {
          final title = item['title'] ??
              item['name'] ??
              item['companyName'] ??
              item['id'] ??
              'Item';
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text('- $title'),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text('- ${item.toString()}'),
        );
      }).toList(),
    );
  }

  Widget _buildNoAccessNotice() {
    return Card(
      elevation: 0,
      color: WalletColor.backgroundWhite,
      child: const Padding(
        padding: EdgeInsets.all(12),
        child: Text('No mobile permissions assigned yet.'),
      ),
    );
  }
}
