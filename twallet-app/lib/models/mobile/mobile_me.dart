import 'package:tw_wallet_ui/models/mobile/mobile_user.dart';

class MobileMe {
  final MobileUser user;
  final List<String> roles;
  final List<String> permissions;
  final Map<String, bool> platforms;
  final String? primaryRole;
  final String? paymentMode;

  const MobileMe({
    required this.user,
    required this.roles,
    required this.permissions,
    required this.platforms,
    required this.primaryRole,
    required this.paymentMode,
  });

  factory MobileMe.fromJson(Map<String, dynamic> json) {
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

    return MobileMe(
      user: MobileUser.fromJson(
        (json['user'] as Map<String, dynamic>? ?? const {}),
      ),
      roles: roles,
      permissions: permissions,
      platforms: platforms,
      primaryRole: json['primaryRole']?.toString(),
      paymentMode: json['paymentMode']?.toString(),
    );
  }
}
