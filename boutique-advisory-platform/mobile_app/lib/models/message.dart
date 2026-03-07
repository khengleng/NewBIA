class Conversation {
  final String id;
  final List<String> participants;
  final List<ParticipantDetail> participantDetails;
  final String? dealId;
  final String lastMessage;
  final DateTime lastMessageAt;
  final Map<String, int> unreadCount;

  Conversation({
    required this.id,
    required this.participants,
    required this.participantDetails,
    this.dealId,
    required this.lastMessage,
    required this.lastMessageAt,
    required this.unreadCount,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      participants: List<String>.from(json['participants']),
      participantDetails: (json['participantDetails'] as List)
          .map((p) => ParticipantDetail.fromJson(p))
          .toList(),
      dealId: json['dealId'] as String?,
      lastMessage: json['lastMessage'] as String? ?? '',
      lastMessageAt: DateTime.parse(json['lastMessageAt'] as String),
      unreadCount: Map<String, int>.from(json['unreadCount'] ?? {}),
    );
  }
}

class ParticipantDetail {
  final String id;
  final String name;
  final String type;

  ParticipantDetail({required this.id, required this.name, required this.type});

  factory ParticipantDetail.fromJson(Map<String, dynamic> json) {
    return ParticipantDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
    );
  }
}

enum MessageType { TEXT, IMAGE, DOCUMENT, DEAL_LINK }

class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final String senderType;
  final String content;
  final String type;
  final List<dynamic>? attachments;
  final bool read;
  final DateTime createdAt;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.senderType,
    required this.content,
    required this.type,
    this.attachments,
    required this.read,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      senderName: json['senderName'] as String,
      senderType: json['senderType'] as String,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'TEXT',
      attachments: json['attachments'] as List?,
      read: json['read'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
