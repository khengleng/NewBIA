class MobileWalletTransaction {
  final String id;
  final double amount;
  final String type;
  final String status;
  final DateTime createdAt;
  final String? description;

  const MobileWalletTransaction({
    required this.id,
    required this.amount,
    required this.type,
    required this.status,
    required this.createdAt,
    required this.description,
  });

  factory MobileWalletTransaction.fromJson(Map<String, dynamic> json) {
    return MobileWalletTransaction(
      id: (json['id'] ?? '').toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      type: (json['type'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      description: json['description']?.toString(),
    );
  }
}
