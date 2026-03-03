import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'core/services/notification_service.dart';

/// Supabase localStorage implementation backed by flutter_secure_storage.
/// This stores the auth JWT in the OS keychain (iOS) / Android Keystore (Android)
/// instead of SharedPreferences plain-text, satisfying GDPR Art. 32 and
/// ISO 27001 A.10.1 for stored credentials.
class _SecureLocalStorage extends LocalStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() =>
      _storage.containsKey(key: supabasePersistSessionKey);

  @override
  Future<String?> accessToken() =>
      _storage.read(key: supabasePersistSessionKey);

  @override
  Future<void> removePersistedSession() =>
      _storage.delete(key: supabasePersistSessionKey);

  @override
  Future<void> persistSession(String persistSessionString) =>
      _storage.write(key: supabasePersistSessionKey, value: persistSessionString);
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize locale data for date formatting (de, de_DE)
  await initializeDateFormatting('de', null);
  await initializeDateFormatting('de_DE', null);

  // Status bar style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  // Preferred orientations — portrait on phone, all orientations on tablet
  final view = WidgetsBinding.instance.platformDispatcher.views.first;
  final shortestSide = view.physicalSize.shortestSide / view.devicePixelRatio;
  final isTablet = shortestSide >= 600;
  if (isTablet) {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  } else {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }

  // Initialize Supabase
  // Credentials are injected at build time via --dart-define (never hardcoded).
  // Local dev: add a dart_defines.json file (gitignored) and run:
  //   flutter run --dart-define-from-file=dart_defines.json
  // CI/CD: pass --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
  const supabaseUrl =
      String.fromEnvironment('SUPABASE_URL');
  const supabaseAnonKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  assert(supabaseUrl.isNotEmpty,
      'SUPABASE_URL is not set. Pass --dart-define=SUPABASE_URL=<url>');
  assert(supabaseAnonKey.isNotEmpty,
      'SUPABASE_ANON_KEY is not set. Pass --dart-define=SUPABASE_ANON_KEY=<key>');

  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    // Store auth tokens in the OS secure keychain/keystore instead of
    // SharedPreferences plain-text (GDPR Art. 32 / ISO 27001 A.10.1).
    authOptions: FlutterAuthClientOptions(
      localStorage: _SecureLocalStorage(),
    ),
  );

  // Initialize local notifications
  await NotificationService.initialize();

  // Google Fonts — allow runtime fetching (fonts are cached after first load)
  GoogleFonts.config.allowRuntimeFetching = true;

  runApp(const ProviderScope(child: DocStrucApp()));
}

class DocStrucApp extends ConsumerWidget {
  const DocStrucApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'DocStruc',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('de', 'DE'),
        Locale('en', 'US'),
      ],
      locale: const Locale('de', 'DE'),
    );
  }
}
