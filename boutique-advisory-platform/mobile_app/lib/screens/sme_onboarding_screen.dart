import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:animate_do/animate_do.dart';
import 'package:cambobia_mobile/core/api_client.dart';

class SmeOnboardingScreen extends ConsumerStatefulWidget {
  const SmeOnboardingScreen({super.key});

  @override
  ConsumerState<SmeOnboardingScreen> createState() => _SmeOnboardingScreenState();
}

class _SmeOnboardingScreenState extends ConsumerState<SmeOnboardingScreen> {
  final _pageController = PageController();
  int _currentStep = 0;
  bool _isSubmitting = false;

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _websiteController = TextEditingController();
  final _locationController = TextEditingController();
  final _amountController = TextEditingController();
  final _descController = TextEditingController();

  String _selectedSector = 'Retail';
  String _selectedStage = 'SEED';

  final List<String> _sectors = ['Retail', 'Tech', 'Fintech', 'Real Estate', 'Logistics'];
  final List<String> _stages = ['PRESEED', 'SEED', 'SERIES_A', 'SERIES_B'];

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    
    try {
      final apiClient = ref.read(apiClientProvider);
      final user = await apiClient.getStoredUser();
      
      final response = await apiClient.post('/sme', data: {
        'ownerFirstName': user?['firstName'] ?? 'Founder',
        'ownerLastName': user?['lastName'] ?? '',
        'ownerEmail': user?['email'] ?? 'founder@cambobia.com',
        'name': _nameController.text,
        'sector': _selectedSector,
        'stage': _selectedStage,
        'fundingRequired': double.tryParse(_amountController.text) ?? 50000,
        'description': _descController.text,
        'website': _websiteController.text,
        'location': _locationController.text,
        'onboardingMode': 'DIRECT'
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('SME Onboarding Complete! Redirecting...'), backgroundColor: Colors.greenAccent),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Submission failed: $e'), backgroundColor: Colors.redAccent),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _next() {
    if (_currentStep < 2) {
      _pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    } else {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Founder Portal Onboarding')),
      body: Column(
        children: [
          LinearProgressIndicator(value: (_currentStep + 1) / 3, backgroundColor: Colors.white10),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (index) => setState(() => _currentStep = index),
              children: [
                _buildStepOne(),
                _buildStepTwo(),
                _buildStepThree(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              if (_currentStep > 0)
                IconButton(
                  onPressed: () => _pageController.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut),
                  icon: const Icon(Icons.arrow_back, color: Colors.blueAccent),
                ),
              const Spacer(),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _next,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16)),
                child: _isSubmitting 
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) 
                    : Text(_currentStep == 2 ? 'Launch Portfolio' : 'Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepOne() {
    return FadeIn(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Asset Fundamentals', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 12),
            const Text('Institutional advisors require high-fidelity data about your core operations.', style: TextStyle(color: Colors.white54)),
            const SizedBox(height: 32),
            TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Company/Asset Name', hintText: 'e.g. Phnom Penh Retail Group')),
            const SizedBox(height: 20),
            TextField(controller: _websiteController, decoration: const InputDecoration(labelText: 'Digital Domain', hintText: 'https://...') ),
            const SizedBox(height: 20),
            TextField(controller: _locationController, decoration: const InputDecoration(labelText: 'Operational HQ', hintText: 'Siem Reap, Cambodia')),
          ],
        ),
      ),
    );
  }

  Widget _buildStepTwo() {
    return FadeIn(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Sector & Scaling Stage', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 32),
            const Text('Market Sector', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedSector,
              onChanged: (v) => _selectedSector = v!,
              items: _sectors.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            ),
            const SizedBox(height: 24),
            const Text('Asset Growth Stage', style: TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedStage,
              onChanged: (v) => _selectedStage = v!,
              items: _stages.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepThree() {
    return FadeIn(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Institutional Funding', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 32),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Capital Requirement (USD)', prefixText: '\$'),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _descController,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Boutique Advisory Thesis', hintText: 'How will this capital catalyze expansion?'),
            ),
          ],
        ),
      ),
    );
  }
}
