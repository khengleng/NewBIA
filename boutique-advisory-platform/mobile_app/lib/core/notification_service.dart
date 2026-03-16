import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cambobia_mobile/core/api_client.dart';
import 'dart:math';

class PushNotificationService {
  final ApiClient apiClient;

  PushNotificationService(this.apiClient);

  Future<void> initialize(String userId) async {
    // 1. Mock FCM Token registration
    final mockToken = "fcm_token_${Random().nextInt(1000000)}";
    
    try {
      // Register with mobile-bot-service or backend proxy
      await apiClient.post('/mobile/register-push', data: {
        'userId': userId,
        'fcmToken': mockToken,
        'deviceType': 'ios'
      });
      print('✅ Registered push token: $mockToken');
    } catch (e) {
      print('❌ Failed to register push token: $e');
    }
  }

  // Handle foreground messages (mock)
  void listenForMockNotifications() {
    // In real app: FirebaseMessaging.onMessage.listen((RemoteMessage message) { ... });
  }
}

final pushProvider = Provider((ref) => PushNotificationService(ref.read(apiClientProvider)));
