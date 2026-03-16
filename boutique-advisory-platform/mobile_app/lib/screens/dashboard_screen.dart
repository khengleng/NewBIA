import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:animate_do/animate_do.dart';
import 'package:shimmer/shimmer.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cambobia_mobile/core/api_client.dart';
import 'package:intl/intl.dart';
import 'package:cambobia_mobile/screens/deal_detail_screen.dart';
import 'package:cambobia_mobile/screens/conversations_list_screen.dart';
import 'package:cambobia_mobile/screens/sme_onboarding_screen.dart';
import 'package:cambobia_mobile/screens/account_screen.dart';
import 'package:cambobia_mobile/models/secondary_listing.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _selectedIndex = 0;
  final _pageController = PageController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) => setState(() => _selectedIndex = index),
        children: [
          const MarketHome(),
          const ConversationsListScreen(),
          const AccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.show_chart), label: 'Market'),
          NavigationDestination(icon: Icon(Icons.forum_outlined), label: 'Inbox'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Account'),
        ],
      ),
    );
  }
}

class MarketHome extends ConsumerStatefulWidget {
  const MarketHome({super.key});

  @override
  ConsumerState<MarketHome> createState() => _MarketHomeState();
}

class _MarketHomeState extends ConsumerState<MarketHome> {
  bool _isLoading = true;
  List<dynamic> _deals = [];
  List<SecondaryListing> _listings = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      final results = await Future.wait([
        apiClient.get('/deals'),
        apiClient.get('/secondary-trading/listings'),
      ]);

      if (mounted) {
        setState(() {
          _deals = results[0].data ?? [];
          _listings = (results[1].data as List? ?? [])
              .map((l) => SecondaryListing.fromJson(l))
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

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E11),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Markets', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(onPressed: _fetchData, icon: const Icon(Icons.refresh, color: Color(0xFFF0B90B))),
          IconButton(onPressed: () {}, icon: const Icon(Icons.search, color: Colors.white70)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        color: const Color(0xFFF0B90B),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Market Ticker (Binance Style)
              Container(
                height: 40,
                width: double.infinity,
                color: const Color(0xFF1E2329),
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildTicker('SME/USD', '1.25', '+1.2%'),
                    _buildTicker('AGRI/USD', '0.85', '-0.5%'),
                    _buildTicker('TECH/USD', '5.42', '+2.3%'),
                    _buildTicker('SME/USD', '1.00', '0.0%'),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    const Text('Top Offerings', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    const Spacer(),
                    TextButton(onPressed: () {}, child: const Text('Favorites', style: TextStyle(color: Color(0xFFF0B90B), fontSize: 12))),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 170,
                child: _isLoading 
                    ? _buildQuickTradeShimmer()
                    : _listings.isEmpty
                        ? _buildNoListings()
                        : ListView.builder(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _listings.length,
                            itemBuilder: (context, index) => _buildQuickTradeCard(_listings[index]),
                          ),
              ),
              
              const SizedBox(height: 32),
              
              // 2. Tab-like Categories
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    _buildCategoryTab('All', true),
                    _buildCategoryTab('Technology', false),
                    _buildCategoryTab('Fintech', false),
                    _buildCategoryTab('Agriculture', false),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Text('Institutional SMEs', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 16),
              if (_isLoading)
                Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: _buildPrimaryShimmer())
              else if (_deals.isEmpty)
                const Center(child: Text('No active deals found.'))
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(children: _deals.map((d) => _buildDealCard(d, cur)).toList()),
                ),
                
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTicker(String pair, String price, String change) {
    final isPos = change.startsWith('+');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Text(pair, style: const TextStyle(color: Color(0xFF848E9C), fontSize: 11, fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          Text(price, style: const TextStyle(color: Colors.white, fontSize: 11)),
          const SizedBox(width: 4),
          Text(change, style: TextStyle(color: isPos ? const Color(0xFF0ECB81) : const Color(0xFFF6465D), fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildCategoryTab(String title, bool isActive) {
    return Container(
      margin: const EdgeInsets.only(right: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFFF0B90B).withOpacity(0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        title,
        style: TextStyle(
          color: isActive ? const Color(0xFFF0B90B) : const Color(0xFF848E9C),
          fontSize: 13,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }

  Widget _buildQuickTradeCard(SecondaryListing listing) {
    final cardBg = const Color(0xFF1E2329);
    final isPositive = (listing.pricePerShare % 2) == 0;
    return FadeInRight(
      child: InkWell(
        onTap: () => _showTradeSheet(listing),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: 160,
          margin: const EdgeInsets.only(right: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(listing.dealTitle.substring(0, 3).toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  Text(isPositive ? '+2.4%' : '-1.2%', style: TextStyle(color: isPositive ? const Color(0xFF0ECB81) : const Color(0xFFF6465D), fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 4),
              Text(listing.sector, style: const TextStyle(color: Color(0xFF848E9C), fontSize: 10)),
              const Spacer(),
              SizedBox(
                height: 30,
                width: double.infinity,
                child: CustomPaint(painter: SparklinePainter(color: isPositive ? const Color(0xFF0ECB81) : const Color(0xFFF6465D), points: isPositive ? [0.2, 0.4, 0.3, 0.6, 0.5, 0.8, 0.7, 0.9] : [0.8, 0.6, 0.7, 0.4, 0.5, 0.2, 0.3, 0.1])),
              ),
              const SizedBox(height: 12),
              Text('\$${listing.pricePerShare}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
              Text('Vol: ${listing.sharesAvailable.toInt()} shrs', style: const TextStyle(color: Color(0xFF848E9C), fontSize: 9)),
            ],
          ),
        ),
      ),
    );
  }

  void _showTradeSheet(SecondaryListing listing) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) => TradeExecutionSheet(listing: listing),
    );
  }

  Widget _buildNoListings() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      child: const Center(child: Text('No secondary listings available.', style: TextStyle(color: Colors.white24))),
    );
  }

  Widget _buildDealCard(dynamic deal, NumberFormat format) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (c) => DealDetailScreen(initialDeal: deal))),
        child: ListTile(
          leading: const Icon(Icons.business_center_outlined, color: Colors.blueAccent),
          title: Text(deal['title'] ?? 'Growth Deal', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          subtitle: Text(deal['sme']?['sector'] ?? 'SME Equity', style: const TextStyle(color: Colors.white38, fontSize: 12)),
          trailing: Text(format.format(deal['amount'] ?? 500000), style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }

  Widget _buildQuickTradeShimmer() {
    return ListView.builder(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: 3,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: const Color(0xFF1E293B),
        highlightColor: const Color(0xFF334155),
        child: Container(width: 140, margin: const EdgeInsets.only(right: 16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20))),
      ),
    );
  }

  Widget _buildPrimaryShimmer() {
    return Shimmer.fromColors(baseColor: const Color(0xFF1E293B), highlightColor: const Color(0xFF334155), child: Container(height: 100, color: Colors.white));
  }
}

class TradeExecutionSheet extends ConsumerStatefulWidget {
  final SecondaryListing listing;
  const TradeExecutionSheet({super.key, required this.listing});

  @override
  ConsumerState<TradeExecutionSheet> createState() => _TradeExecutionSheetState();
}

class _TradeExecutionSheetState extends ConsumerState<TradeExecutionSheet> {
  int _shares = 1;
  bool _isProcessing = false;

  Future<void> _executeTrade() async {
    setState(() => _isProcessing = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.post('/secondary-trading/listings/${widget.listing.id}/buy', data: {'shares': _shares, 'simulate_payment': true});
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Trade Executed Successfully!'), backgroundColor: Colors.greenAccent));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Trade Failed: $e'), backgroundColor: Colors.redAccent));
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _shares * widget.listing.pricePerShare;
    final fee = total * 0.01;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Buy ${widget.listing.dealTitle}', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Sector: ${widget.listing.sector}', style: const TextStyle(color: Colors.white38)),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Quantity', style: TextStyle(color: Colors.white, fontSize: 16)),
              Row(
                children: [
                  IconButton(onPressed: _shares > 1 ? () => setState(() => _shares--) : null, icon: const Icon(Icons.remove_circle_outline, color: Colors.blueAccent)),
                  Text('$_shares', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  IconButton(onPressed: _shares < widget.listing.sharesAvailable ? () => setState(() => _shares++) : null, icon: const Icon(Icons.add_circle_outline, color: Colors.blueAccent)),
                ],
              ),
            ],
          ),
          const Divider(color: Colors.white10, height: 40),
          _buildRow('Price per Share', '\$${widget.listing.pricePerShare}'),
          _buildRow('Subtotal', '\$${total.toStringAsFixed(2)}'),
          _buildRow('Institutional Fee (1%)', '\$${fee.toStringAsFixed(2)}'),
          const SizedBox(height: 12),
          _buildRow('Total Cost', '\$${(total + fee).toStringAsFixed(2)}', isBold: true),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isProcessing ? null : _executeTrade,
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18), backgroundColor: Colors.blueAccent),
              child: _isProcessing ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Confirm Execution'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isBold ? Colors.white : Colors.white54)),
          Text(value, style: TextStyle(color: Colors.white, fontWeight: isBold ? FontWeight.bold : FontWeight.normal, fontSize: isBold ? 18 : 14)),
        ],
      ),
    );
  }
}

class SparklinePainter extends CustomPainter {
  final Color color;
  final List<double> points;
  SparklinePainter({required this.color, required this.points});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 2.0..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round;
    final path = Path();
    if (points.isEmpty) return;
    final xStep = size.width / (points.length - 1);
    path.moveTo(0, size.height * (1 - points[0]));
    for (var i = 1; i < points.length; i++) {
      path.lineTo(i * xStep, size.height * (1 - points[i]));
    }
    canvas.drawPath(path, paint);
    final fillPath = Path.from(path)..lineTo(size.width, size.height)..lineTo(0, size.height)..close();
    final fillPaint = Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withOpacity(0.2), color.withOpacity(0)]).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(fillPath, fillPaint);
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
