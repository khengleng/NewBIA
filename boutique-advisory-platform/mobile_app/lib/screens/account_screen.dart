import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:animate_do/animate_do.dart';
import 'package:intl/intl.dart';
import 'package:cambobia_mobile/core/api_client.dart';
import 'package:cambobia_mobile/models/portfolio.dart';
import 'package:cambobia_mobile/screens/sme_onboarding_screen.dart';
import 'package:cambobia_mobile/screens/login_screen.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _isLoading = true;
  PortfolioSummary? _summary;
  List<PortfolioItem> _items = [];

  @override
  void initState() {
    super.initState();
    _fetchPortfolio();
  }

  Future<void> _fetchPortfolio() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.get('/investors/portfolio/stats');
      
      if (mounted) {
        setState(() {
          _summary = PortfolioSummary.fromJson(response.data['summary']);
          _items = (response.data['items'] as List)
              .map((i) => PortfolioItem.fromJson(i))
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cur = NumberFormat.currency(symbol: '\$', decimalDigits: 0);

    String getTitle(String? role) {
      if (role == null) return 'Investor Account';
      if (role == 'SUPER_ADMIN') return 'Platform Admin';
      final r = role.toLowerCase().replaceAll('_', ' ');
      return '${r[0].toUpperCase()}${r.substring(1)} Account';
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E11), // Binance-like dark background
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          getTitle(_summary?.role),
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: () async {
              final apiClient = ref.read(apiClientProvider);
              await apiClient.clearAuth();
              if (mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
            icon: const Icon(Icons.logout, color: Color(0xFFF0B90B)), // Binance Gold
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchPortfolio,
        color: const Color(0xFFF0B90B),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Premium Portfolio Card
              FadeInDown(
                duration: const Duration(milliseconds: 600),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFF1E2329),
                        const Color(0xFF1E2329).withOpacity(0.8),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.5),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      )
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'Total Equity',
                            style: TextStyle(color: Color(0xFF848E9C), fontSize: 13),
                          ),
                          const SizedBox(width: 6),
                          Icon(Icons.visibility_outlined, color: Colors.white.withOpacity(0.3), size: 14),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            _isLoading ? '...' : cur.format(_summary?.totalAum ?? 0),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 34,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -1,
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.only(bottom: 6, left: 8),
                            child: Text(
                              'USD',
                              style: TextStyle(color: Color(0xFFF0B90B), fontSize: 14, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Portfolio Value',
                        style: const TextStyle(color: Color(0xFF848E9C), fontSize: 12),
                      ),
                      const SizedBox(height: 28),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildMiniStat('24h PNL', '+\$1,240.50 (2.4%)', isProfit: true),
                          Container(width: 1, height: 20, color: Colors.white10),
                          _buildMiniStat('Margin Level', 'High Wealth', isProfit: null),
                          Container(width: 1, height: 20, color: Colors.white10),
                          _buildMiniStat('KYC Status', _summary?.kycStatus ?? 'PENDING', isProfit: null),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // 2. Action Buttons (Binance-like)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                   _buildActionButton(Icons.add_circle_outline, 'Deposit'),
                   _buildActionButton(Icons.arrow_circle_up_outlined, 'Withdraw'),
                   _buildActionButton(Icons.swap_horiz_outlined, 'Transfer'),
                   _buildActionButton(Icons.history_outlined, 'History'),
                ],
              ),

              const SizedBox(height: 40),

              // 3. Asset Allocation
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Portfolio Assets',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text('Analyze', style: TextStyle(color: Color(0xFFF0B90B), fontSize: 13)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_isLoading)
                const LinearProgressIndicator(color: Color(0xFFF0B90B), backgroundColor: Colors.white10)
              else if (_items.isEmpty)
                Container(
                  height: 150,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E2329),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Center(
                    child: Text(
                      'No active investments found.',
                      style: TextStyle(color: Color(0xFF848E9C)),
                    ),
                  ),
                )
              else
                ..._items.map((item) => _buildPortfolioItem(item, cur)).toList(),

              const SizedBox(height: 32),

              // 4. SME Portal Access (Improved layout to fix vertical bug)
              FadeInUp(
                child: InkWell(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (c) => const SmeOnboardingScreen())),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E2329),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFF0B90B).withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0B90B).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.business_center, color: Color(0xFFF0B90B), size: 28),
                        ),
                        const SizedBox(width: 20),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Register as SME',
                                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'List your company and raise capital on BIA',
                                style: TextStyle(color: const Color(0xFF848E9C), fontSize: 12),
                                overflow: TextOverflow.visible,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Icon(Icons.chevron_right, color: Color(0xFF848E9C)),
                      ],
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 40),
              
              // 5. App Version / Footer
              Center(
                child: Column(
                  children: [
                    Text(
                      'SMEs Trading Co.,ltd • v1.0.4',
                      style: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () async {
                        final apiClient = ref.read(apiClientProvider);
                        await apiClient.clearAuth();
                        if (mounted) {
                          Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (context) => const LoginScreen()),
                              (route) => false);
                        }
                      },
                      child: const Text('Sign Out', style: TextStyle(color: Colors.redAccent, fontSize: 13)),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String label) {
    return Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: const Color(0xFF1E2329),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Icon(icon, color: const Color(0xFFF0B90B), size: 24),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Color(0xFF848E9C), fontSize: 11)),
      ],
    );
  }

  Widget _buildMiniStat(String label, String value, {bool? isProfit}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF848E9C), fontSize: 10)),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: isProfit == null ? Colors.white : (isProfit ? const Color(0xFF0ECB81) : const Color(0xFFF6465D)),
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildPortfolioItem(PortfolioItem item, NumberFormat format) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E2329),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF0B90B).withOpacity(0.05),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.pie_chart_outline, color: Color(0xFFF0B90B), size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Text(
                  item.sector,
                  style: const TextStyle(color: Color(0xFF848E9C), fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                format.format(item.value),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
              Text(
                '${item.allocation}% Weight',
                style: const TextStyle(color: Color(0xFF0ECB81), fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
