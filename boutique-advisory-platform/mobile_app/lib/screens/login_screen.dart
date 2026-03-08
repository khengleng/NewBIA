import 'package:animate_do/animate_do.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cambobia_mobile/core/api_client.dart';
import 'package:cambobia_mobile/core/biometric_service.dart';
import 'package:cambobia_mobile/core/notification_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _biometricService = BiometricService();
  bool _isLoading = false;
  bool _canCheckBiometrics = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final available = await _biometricService.isBiometricAvailable();
    const storage = FlutterSecureStorage();
    final hasToken = await storage.read(key: 'refreshToken') != null;
    
    if (mounted) {
      setState(() {
        _canCheckBiometrics = available && hasToken;
      });
      
      if (_canCheckBiometrics) {
        _handleBiometricLogin();
      }
    }
  }

  Future<void> _handleBiometricLogin() async {
    final authenticated = await _biometricService.authenticate();
    if (authenticated && mounted) {
      // Initialize Push for the returning user
      final apiClient = ref.read(apiClientProvider);
      final user = await apiClient.getStoredUser(); // Assume this exists or handle ID
      if (user != null) {
        ref.read(pushProvider).initialize(user['id']);
      }
      
      Navigator.pushReplacementNamed(context, '/dashboard');
    }
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = response.data;
        final accessToken = data['accessToken'] as String;
        final refreshToken = data['refreshToken'] as String;
        final user = data['user'];
        
        await apiClient.saveTokens(accessToken, refreshToken, user);
        
        // Initialize Push Notifications
        if (user != null) {
          ref.read(pushProvider).initialize(user['id']);
        }
        
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/dashboard');
        }
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.response?.data?['error'] ?? 'Login failed. Please check your credentials.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'An unexpected error occurred.';
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E11), // Binance-like dark background
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 80),
                // 1. Branding Header
                FadeInDown(
                  duration: const Duration(milliseconds: 800),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0B90B).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.account_balance_wallet, color: Color(0xFFF0B90B), size: 32),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Secure institutional\nAdvisory & Trade',
                        style: TextStyle(
                          fontSize: 34,
                          fontWeight: FontWeight.bold,
                          height: 1.1,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'SMEs Trading Co.,ltd 🇰🇭',
                        style: TextStyle(color: Color(0xFF848E9C), fontSize: 16),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 60),
                
                // 2. Form Fields
                FadeInUp(
                  duration: const Duration(milliseconds: 800),
                  delay: const Duration(milliseconds: 200),
                  child: Column(
                    children: [
                      _buildTextField(
                        controller: _emailController,
                        hint: 'Email / Phone Number',
                        icon: Icons.alternate_email,
                      ),
                      const SizedBox(height: 20),
                      _buildTextField(
                        controller: _passwordController,
                        hint: 'Password',
                        icon: Icons.lock_outline,
                        isPassword: true,
                      ),
                      const SizedBox(height: 32),
                      
                      if (_errorMessage != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.redAccent.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline, color: Colors.redAccent, size: 16),
                                const SizedBox(width: 8),
                                Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontSize: 12))),
                              ],
                            ),
                          ),
                        ),

                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleLogin,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF0B90B),
                            foregroundColor: Colors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 0,
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  height: 24,
                                  width: 24,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                                )
                              : const Text(
                                  'Sign In',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                ),
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      if (_canCheckBiometrics) ...[
                        FadeIn(
                          child: InkWell(
                            onTap: _handleBiometricLogin,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.fingerprint, color: Color(0xFFF0B90B), size: 20),
                                const SizedBox(width: 8),
                                const Text(
                                  'Fingerprint Login',
                                  style: TextStyle(color: Color(0xFF848E9C), fontSize: 14),
                                ),
                              ],
                            ),
                          ),
                        ),
                         const SizedBox(height: 24),
                      ],
                    ],
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // 3. Footer Links
                Center(
                  child: Column(
                    children: [
                      TextButton(
                        onPressed: () {
                          showDialog(
                            context: context,
                            builder: (c) => AlertDialog(
                              backgroundColor: const Color(0xFF1E2329),
                              title: const Text('Investor Account', style: TextStyle(color: Colors.white)),
                              content: const Text(
                                'To create a new SME or Investor account, please visit the BIA Portal on your desktop at trade.cambobia.com.',
                                style: TextStyle(color: Color(0xFF848E9C)),
                              ),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(c), child: const Text('Close', style: TextStyle(color: Color(0xFFF0B90B)))),
                              ],
                            ),
                          );
                        },
                        child: RichText(
                          text: const TextSpan(
                            style: TextStyle(color: Color(0xFF848E9C), fontSize: 14),
                            children: [
                              TextSpan(text: "Don't have an account? "),
                              TextSpan(
                                text: 'Register',
                                style: TextStyle(color: Color(0xFFF0B90B), fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () {},
                        child: const Text(
                          'Forgot Password?',
                          style: TextStyle(color: Color(0xFF848E9C), fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isPassword = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E2329),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: TextField(
        controller: controller,
        obscureText: isPassword,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF848E9C), fontSize: 15),
          prefixIcon: Icon(icon, color: const Color(0xFF848E9C), size: 20),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 18),
        ),
      ),
    );
  }
}
