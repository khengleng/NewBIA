import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:cambobia_mobile/core/api_client.dart';
import 'package:cambobia_mobile/screens/chat_screen.dart';
import 'package:cambobia_mobile/screens/pdf_preview_screen.dart';
import 'package:cambobia_mobile/models/deal.dart';

class DealDetailScreen extends ConsumerStatefulWidget {
  final dynamic initialDeal;

  const DealDetailScreen({super.key, required this.initialDeal});

  @override
  ConsumerState<DealDetailScreen> createState() => _DealDetailScreenState();
}

class _DealDetailScreenState extends ConsumerState<DealDetailScreen> {
  late Deal _deal;
  bool _isFullLoading = true;

  @override
  void initState() {
    super.initState();
    // Start with partial data from list
    _deal = Deal.fromJson(widget.initialDeal);
    _fetchFullDetails();
  }

  Future<void> _fetchFullDetails() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.get('/deals/${_deal.id}');
      if (mounted) {
        setState(() {
          _deal = Deal.fromJson(response.data);
          _isFullLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isFullLoading = false);
    }
  }

  Future<void> _contactAdvisor() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      // Fallback if missing advisor
      const advisorId = 'advisor-1'; 

      final response = await apiClient.post('/messages/start', data: {
        'recipientId': advisorId,
        'dealId': _deal.id,
        'initialMessage': "Hello, I'm interested in the ${_deal.title} deal. I'd like to discuss the next steps.",
      });

      if (mounted) {
        final convId = response.data['id'];
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ChatScreen(
              conversationId: convId,
              title: _deal.title,
            ),
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to connect with advisor.')),
      );
    }
  }

  void _openDocument(AppDocument doc) {
    if (doc.isLocked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Document is locked. Contact advisor for access.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => PDFPreviewScreen(url: doc.url, title: doc.name),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final format = NumberFormat.currency(symbol: '\$', decimalDigits: 0);
    
    return Scaffold(
      appBar: AppBar(title: Text(_deal.title)),
      body: SingleChildScrollView(
        child: Column(
          children: [
            Container(
              height: 240,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF334155), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: const Icon(Icons.business_center, size: 80, color: Colors.blueAccent),
            ),
            
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FadeInUp(
                    child: Text(
                      _deal.title,
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeInUp(
                    delay: const Duration(milliseconds: 100),
                    child: const Text(
                      'SME Capital | Grade-A Advisory',
                      style: TextStyle(fontSize: 14, color: Colors.white54),
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  // Summary Section
                  FadeInUp(
                    delay: const Duration(milliseconds: 200),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildMetric('Target Amount', format.format(_deal.amount)),
                        _buildMetric('Expected IRR', '12.5% ARR'),
                        _buildMetric('Deal Type', 'Equity'),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 48),

                  // Documents Section
                  FadeInUp(
                    delay: const Duration(milliseconds: 300),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Institutional Documents',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
                        ),
                        const SizedBox(height: 16),
                        if (_isFullLoading)
                          const LinearProgressIndicator()
                        else if (_deal.documents.isEmpty)
                          const Text('No public documents available yet.', style: TextStyle(color: Colors.white24))
                        else
                          ..._deal.documents.map((doc) => _buildDocTile(doc)).toList(),
                      ],
                    ),
                  ),

                  const SizedBox(height: 48),
                  
                  FadeInUp(
                    delay: const Duration(milliseconds: 400),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Investment Overview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
                        const SizedBox(height: 12),
                        Text(
                          _deal.description ?? 'Institutional grade SME investment opportunity in the retail expansion sector with exit provisions.',
                          style: const TextStyle(color: Colors.white70, height: 1.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _contactAdvisor,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: Colors.blueAccent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Contact Advisor', style: TextStyle(color: Colors.blueAccent)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Request Access'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDocTile(AppDocument doc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: ListTile(
        onTap: () => _openDocument(doc),
        leading: Icon(
          doc.type == 'PITCH_DECK' ? Icons.description_outlined : Icons.article_outlined,
          color: Colors.blueAccent,
        ),
        title: Text(doc.name, style: const TextStyle(color: Colors.white, fontSize: 14)),
        subtitle: Text(doc.type.replaceAll('_', ' '), style: const TextStyle(color: Colors.white38, fontSize: 11)),
        trailing: Icon(
          doc.isLocked ? Icons.lock_outline : Icons.chevron_right,
          color: Colors.white24,
          size: 20,
        ),
      ),
    );
  }

  Widget _buildMetric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
      ],
    );
  }
}
