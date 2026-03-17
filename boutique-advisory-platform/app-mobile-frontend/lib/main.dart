import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cambobia_mobile/core/theme.dart';
import 'package:cambobia_mobile/screens/login_screen.dart';
import 'package:cambobia_mobile/screens/dashboard_screen.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: SMEsTradingApp()));
}

class SMEsTradingApp extends ConsumerWidget {
  const SMEsTradingApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
  final storage = FlutterSecureStorage();

    return MaterialApp(
      title: 'SMEs Trading Co.,ltd',
      theme: AppTheme.darkTheme,
      debugShowCheckedModeBanner: false,
      home: FutureBuilder<String?>(
        future: storage.read(key: 'accessToken'),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (snapshot.hasData && snapshot.data != null) {
            return const DashboardScreen();
          }
          return const LoginScreen();
        },
      ),
      routes: {
        '/dashboard': (context) => const DashboardScreen(),
        '/login': (context) => const LoginScreen(),
      },
    );
  }
}
