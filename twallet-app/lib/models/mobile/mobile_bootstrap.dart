import 'package:tw_wallet_ui/models/mobile/mobile_user.dart';

class MobileBootstrap {
  final MobileUser user;
  final Map<String, dynamic> wallet;
  final List<dynamic> transactions;
  final List<String> roles;
  final List<String> permissions;

  const MobileBootstrap({
    required this.user,
    required this.wallet,
    required this.transactions,
    required this.roles,
    required this.permissions,
  });

  factory MobileBootstrap.fromJson(Map<String, dynamic> json) {
    final roles = (json['roles'] as List<dynamic>? ?? const [])
        .map((role) => role.toString())
        .toList();
    final permissions = (json['permissions'] as List<dynamic>? ?? const [])
        .map((permission) => permission.toString())
        .toList();
    return MobileBootstrap(
      user: MobileUser.fromJson(
        (json['user'] as Map<String, dynamic>? ?? const {}),
      ),
      wallet: (json['wallet'] as Map<String, dynamic>? ?? const {}),
      transactions: (json['transactions'] as List<dynamic>? ?? const []),
      roles: roles,
      permissions: permissions,
    );
  }
}
