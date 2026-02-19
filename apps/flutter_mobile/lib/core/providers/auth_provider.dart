import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';

// ── Auth State ──────────────────────────────────────────────────────────────
class AuthState {
  final String? userId;
  final Map<String, dynamic>? profile;
  final bool loading;
  final bool isSuperuser;
  final bool isTeamAdmin;

  const AuthState({
    this.userId,
    this.profile,
    this.loading = true,
    this.isSuperuser = false,
    this.isTeamAdmin = false,
  });

  AuthState copyWith({
    String? userId,
    Map<String, dynamic>? profile,
    bool? loading,
    bool? isSuperuser,
    bool? isTeamAdmin,
    bool clearUser = false,
  }) {
    return AuthState(
      userId: clearUser ? null : (userId ?? this.userId),
      profile: clearUser ? null : (profile ?? this.profile),
      loading: loading ?? this.loading,
      isSuperuser: clearUser ? false : (isSuperuser ?? this.isSuperuser),
      isTeamAdmin: clearUser ? false : (isTeamAdmin ?? this.isTeamAdmin),
    );
  }

  String get displayName {
    if (profile == null) return '';
    final first = profile!['first_name'] ?? '';
    final last = profile!['last_name'] ?? '';
    return '$first $last'.trim();
  }

  String get initials {
    final name = displayName;
    if (name.isEmpty) return '?';
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  String? get avatarUrl => profile?['avatar_url'];
  String? get email => profile?['email'];
}

// ── Auth Notifier ───────────────────────────────────────────────────────────
class AuthNotifier extends StateNotifier<AuthState> {
  StreamSubscription<AuthState>? _authSub;

  AuthNotifier() : super(const AuthState()) {
    _init();
  }

  Future<void> _init() async {
    try {
      final session = SupabaseService.auth.currentSession;
      if (session != null) {
        await _loadProfile(session.user.id);
      }
    } catch (e) {
      // Ignore init errors
    } finally {
      state = state.copyWith(loading: false);
    }

    // Listen for auth changes
    SupabaseService.auth.onAuthStateChange.listen((data) async {
      final session = data.session;
      if (session != null) {
        await _loadProfile(session.user.id);
      } else {
        state = const AuthState(loading: false);
      }
    });
  }

  Future<void> _loadProfile(String userId) async {
    final profile = await SupabaseService.getProfile(userId);
    state = state.copyWith(
      userId: userId,
      profile: profile,
      loading: false,
      isSuperuser: profile?['is_superuser'] == true,
      isTeamAdmin: profile?['team_role'] == 'admin',
    );
  }

  Future<void> refreshProfile() async {
    if (state.userId != null) {
      await _loadProfile(state.userId!);
    }
  }

  Future<String?> signIn(String email, String password) async {
    try {
      final res = await SupabaseService.signIn(email, password);
      if (res.user != null) {
        await _loadProfile(res.user!.id);
        return null; // success
      }
      return 'Anmeldung fehlgeschlagen';
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
    String? companyName,
  }) async {
    try {
      final res = await SupabaseService.signUp(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        companyName: companyName,
      );
      if (res.user != null) {
        await _loadProfile(res.user!.id);
        return null;
      }
      return 'Registrierung fehlgeschlagen';
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }

  Future<void> signOut() async {
    await SupabaseService.signOut();
    state = const AuthState(loading: false);
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}

// ── Providers ───────────────────────────────────────────────────────────────
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
