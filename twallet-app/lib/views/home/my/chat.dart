import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart' as core;
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';
import 'package:flutter_firebase_chat_core/flutter_firebase_chat_core.dart';
import 'package:flutter_svg/svg.dart';
import 'package:tw_wallet_ui/common/application.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/widgets/layouts/common_layout.dart';

enum BackIcon { none, arrow }

class ChatPage extends StatefulWidget {
  final types.Room room;
  final types.User? user;

  const ChatPage({
    required this.room,
    this.user,
  });

  @override
  _ChatPageState createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final core.InMemoryChatController _chatController =
      core.InMemoryChatController();

  @override
  void initState() {
    super.initState();
  }

  Future<void> _handleSendPressed(types.PartialText message) async {
    FirebaseChatCore.instance.sendMessage(
      message,
      widget.room.id,
    );
    final Map<String, dynamic> messageMap = message.toJson();
    messageMap['updatedAt'] = FieldValue.serverTimestamp();
    FirebaseChatCore.instance
        .getFirebaseFirestore()
        .collection('rooms')
        .doc(widget.room.id)
        .set(messageMap, SetOptions(merge: true));
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = FirebaseChatCore.instance.firebaseUser?.uid ?? '';
    return CommonLayout(
      customTitle: ChatTitleBar(
        userName: widget.room.name ?? widget.user!.firstName ?? '',
        avatorUrl: widget.room.imageUrl ??
            'https://i.picsum.photos/id/1/200/300.jpg?hmac=jH5bDkLr6Tgy3oAg5khKCHeunZMHq0ehBZr6vGifPLY',
      ),
      bottomBackColor: WalletColor.white,
      child: Scaffold(
        body: StreamBuilder<types.Room>(
          initialData: widget.room,
          stream: FirebaseChatCore.instance.room(widget.room.id),
          builder: (context, snapshot) {
            return StreamBuilder<List<types.Message>>(
              initialData: const [],
              stream: FirebaseChatCore.instance.messages(snapshot.data!),
              builder: (context, snapshot) {
                return SafeArea(
                  bottom: false,
                  child: Builder(
                    builder: (context) {
                      final coreMessages =
                          (snapshot.data ?? const <types.Message>[])
                              .map(_mapMessage)
                              .toList();
                      _chatController.setMessages(coreMessages);
                      return Chat(
                        theme: core.ChatTheme.fromThemeData(
                          Theme.of(context).copyWith(
                            colorScheme: Theme.of(context)
                                .colorScheme
                                .copyWith(primary: WalletColor.primary),
                          ),
                        ),
                        chatController: _chatController,
                        currentUserId: currentUserId,
                        resolveUser: _resolveUser,
                        onMessageSend: (text) => _handleSendPressed(
                          types.PartialText(text: text),
                        ),
                      );
                    },
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  core.Message _mapMessage(types.Message message) {
    final createdAt = message.createdAt != null
        ? DateTime.fromMillisecondsSinceEpoch(message.createdAt!)
        : null;

    if (message is types.TextMessage) {
      return core.Message.text(
        id: message.id,
        authorId: message.author.id,
        createdAt: createdAt,
        text: message.text,
      );
    }

    if (message is types.ImageMessage) {
      return core.Message.text(
        id: message.id,
        authorId: message.author.id,
        createdAt: createdAt,
        text: message.name ?? 'Image',
      );
    }

    return core.Message.text(
      id: message.id,
      authorId: message.author.id,
      createdAt: createdAt,
      text: 'Unsupported message',
    );
  }

  Future<core.User?> _resolveUser(core.UserID id) async {
    if (widget.user != null && widget.user!.id == id) {
      return core.User(id: id, name: widget.user!.firstName);
    }
    return core.User(id: id);
  }
}

class ChatTitleBar extends StatelessWidget {
  final String userName;
  final String avatorUrl;
  final String? phone;
  final BackIcon backIcon;
  final BeforeDispose? beforeDispose;

  const ChatTitleBar({
    required this.userName,
    required this.avatorUrl,
    this.phone = '',
    this.backIcon = BackIcon.arrow,
    this.beforeDispose,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (backIcon != BackIcon.none)
              IconButton(
                icon: SvgPicture.asset(
                  'assets/icons/back-arrow.svg',
                  // color: WalletColor.white
                ),
                iconSize: 30,
                color: WalletColor.white,
                onPressed: () async {
                  void safeUseBuildContextAsynchronously() =>
                      Application.router.pop(context);

                  if (null != beforeDispose) {
                    await beforeDispose!();
                  }

                  safeUseBuildContextAsynchronously();
                },
              ),
            CircleAvatar(
              radius: 24,
              backgroundImage: NetworkImage(avatorUrl),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      userName,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w500,
                        color: WalletColor.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
