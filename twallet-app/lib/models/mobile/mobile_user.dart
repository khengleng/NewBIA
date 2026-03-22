class MobileUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String did;

  const MobileUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.did,
  });

  factory MobileUser.fromJson(Map<String, dynamic> json) {
    return MobileUser(
      id: (json['id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      did: (json['did'] ?? '').toString(),
    );
  }
}
