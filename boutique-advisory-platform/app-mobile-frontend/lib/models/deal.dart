class Deal {
  final String id;
  final String title;
  final String? description;
  final double amount;
  final String status;
  final DateTime createdAt;
  final List<AppDocument> documents;

  Deal({
    required this.id,
    required this.title,
    this.description,
    required this.amount,
    required this.status,
    required this.createdAt,
    this.documents = const [],
  });

  factory Deal.fromJson(Map<String, dynamic> json) {
    return Deal(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      amount: (json['amount'] as num).toDouble(),
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      documents: (json['documents'] as List? ?? [])
          .map((d) => AppDocument.fromJson(d))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'amount': amount,
      'status': status,
      'createdAt': createdAt.toIso8601String(),
      'documents': documents.map((e) => e.toJson()).toList(),
    };
  }
}

class AppDocument {
  final String id;
  final String name;
  final String type;
  final String url;
  final bool isLocked;

  AppDocument({
    required this.id,
    required this.name,
    required this.type,
    required this.url,
    this.isLocked = false,
  });

  factory AppDocument.fromJson(Map<String, dynamic> json) {
    return AppDocument(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
      url: json['url'] as String,
      isLocked: json['isLocked'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'url': url,
      'isLocked': isLocked,
    };
  }
}
