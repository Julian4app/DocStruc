import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

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

  // Preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Supabase
  await Supabase.initialize(
    url: 'https://vnwovhrwaxbewelgfwsy.supabase.co',
    anonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZud292aHJ3YXhiZXdlbGdmd3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzk2NjIsImV4cCI6MjA4NTgxNTY2Mn0.bKpd1MPraBBhNEtuC6KhMWLrnaXEuuqcH-Co-Ygk3Gg',
  );

  // Preload Google Fonts
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
    );
  }
}
