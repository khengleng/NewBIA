import 'dart:async';

import 'package:fluro/fluro.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';
<<<<<<< HEAD
=======
import 'package:flutter/foundation.dart';
>>>>>>> origin/codex/review-source-code-3e131v
import 'package:sentry/sentry.dart';
import 'package:tw_wallet_ui/common/application.dart';
import 'package:tw_wallet_ui/common/theme/color.dart';
import 'package:tw_wallet_ui/common/theme/font.dart';
import 'package:tw_wallet_ui/generated/l10n.dart';
import 'package:tw_wallet_ui/router/routers.dart';
import 'package:tw_wallet_ui/views/splash_screen/splash_screen.dart';

<<<<<<< HEAD
final SentryClient sentry = SentryClient(
  SentryOptions()
    ..dsn =
        "https://cbc45c2b4f0f400797ca489f4f117699@o402661.ingest.sentry.io/5264109",
);
=======
const String sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');

final SentryClient? sentry = sentryDsn.isEmpty
    ? null
    : SentryClient(
        SentryOptions()..dsn = sentryDsn,
      );
>>>>>>> origin/codex/review-source-code-3e131v

bool get isInDebugMode {
  bool inDebugMode = false;
  assert(inDebugMode = true);
  return inDebugMode;
}

<<<<<<< HEAD
Future<Future<SentryId>> _reportError(dynamic error, dynamic stackTrace) async {
  return sentry.captureException(
    false,
=======
Future<SentryId> _reportError(dynamic error, dynamic stackTrace) async {
  if (sentry == null) {
    if (kDebugMode) {
      debugPrint('Sentry disabled: $error');
    }
    return Future.value(SentryId.empty());
  }

  return sentry!.captureException(
    error,
>>>>>>> origin/codex/review-source-code-3e131v
    stackTrace: stackTrace,
  );
}

Future<void> main() async {
  FlutterError.onError = (FlutterErrorDetails details) async {
    if (isInDebugMode) {
      FlutterError.dumpErrorToConsole(details);
    } else {
      await _reportError(details.exception, details.stack);
    }
  };

  runApp(
    const SplashScreen(
      onInitializationComplete: runMainApp,
    ),
  );
}

void runMainApp(String initialRoute) {
  runZonedGuarded(
    () => runApp(TWallet(initialRoute: initialRoute)),
    (error, stackTrace) async {
      await _reportError(error, stackTrace);
    },
  );
}

class TWallet extends StatelessWidget {
  final String initialRoute;
  final List<NavigatorObserver> navigatorObservers;

  TWallet({required this.initialRoute, this.navigatorObservers = const []}) {
    final router = FluroRouter();
    Routes.configureRoutes(router);
    Application.router = router;
  }

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      designSize: const Size(375, 812),
      builder: (context, child) => GetMaterialApp(
        navigatorObservers: navigatorObservers,
        debugShowCheckedModeBanner: false,
        title: Application.appName,
        theme: ThemeData(
          primaryColor: WalletColor.white,
          textTheme: TextTheme(
            bodyText2: WalletFont.font_14(
              textStyle: TextStyle(
                color: WalletColor.primary,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),
          disabledColor: Colors.grey,
          fontFamily: 'PingFangHK',
        ),
        initialRoute: initialRoute,
        onGenerateRoute: Application.router.generator,
        localizationsDelegates: const [
          S.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: S.delegate.supportedLocales,
      ),
    );
  }
}
