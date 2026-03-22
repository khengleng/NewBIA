import 'package:tw_wallet_ui/models/mobile/mobile_user.dart';

class MobileBootstrap {
  final MobileUser user;
  final Map<String, dynamic> wallet;
  final List<dynamic> transactions;
  final List<String> roles;
  final List<String> permissions;
  final Map<String, bool> platforms;
  final String? primaryRole;
  final String? paymentMode;

  const MobileBootstrap({
    required this.user,
    required this.wallet,
    required this.transactions,
    required this.roles,
    required this.permissions,
    required this.platforms,
    required this.primaryRole,
    required this.paymentMode,
  });

  factory MobileBootstrap.fromJson(Map<String, dynamic> json) {
    final roles = (json['roles'] as List<dynamic>? ?? const [])
        .map((role) => role.toString())
        .toList();
    final permissions = (json['permissions'] as List<dynamic>? ?? const [])
        .map((permission) => permission.toString())
        .toList();
    final platformsRaw = json['platforms'] as Map<String, dynamic>? ?? const {};
    final platforms = <String, bool>{
      for (final entry in platformsRaw.entries)
        entry.key: entry.value == true,
    };
    return MobileBootstrap(
      user: MobileUser.fromJson(
        (json['user'] as Map<String, dynamic>? ?? const {}),
      ),
      wallet: (json['wallet'] as Map<String, dynamic>? ?? const {}),
      transactions: (json['transactions'] as List<dynamic>? ?? const []),
      roles: roles,
      permissions: permissions,
      platforms: platforms,
      primaryRole: json['primaryRole']?.toString(),
      paymentMode: json['paymentMode']?.toString(),
    );
  }
}
