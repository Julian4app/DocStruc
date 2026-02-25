import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/app_colors.dart';
import '../utils/tablet_utils.dart';
import '../../features/quick_add/quick_add_sheet.dart';

// ─── Shell ───────────────────────────────────────────────────────────────────

class AppShell extends ConsumerStatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  @override
  Widget build(BuildContext context) {
    if (isTablet(context)) {
      return _TabletShell(child: widget.child);
    }
    return Scaffold(
      backgroundColor: AppColors.background,
      extendBody: true,
      body: widget.child,
      bottomNavigationBar: const _BottomNav(),
    );
  }
}

// ─── Tablet shell: polished NavigationRail on the left ───────────────────────

class _TabletShell extends StatelessWidget {
  final Widget child;
  const _TabletShell({required this.child});

  static const _tabs = [
    _Tab(icon: LucideIcons.layoutGrid,  label: 'Projekte',       path: '/'),
    _Tab(icon: LucideIcons.helpCircle,  label: 'Hilfe',          path: '/help'),
    _Tab(icon: LucideIcons.bell,        label: 'Benachrichtigungen', path: '/notifications'),
    _Tab(icon: LucideIcons.user,        label: 'Profil',         path: '/profile'),
    _Tab(icon: LucideIcons.settings,    label: 'Einstellungen',  path: '/settings'),
  ];

  @override
  Widget build(BuildContext context) {
    final location      = GoRouterState.of(context).matchedLocation;
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final railBg        = isDark ? const Color(0xFF0F172A) : const Color(0xFF0E2A47);
    final activeColor   = Colors.white;
    final inactiveColor = Colors.white.withValues(alpha: 0.40);

    int selectedIdx = _tabs.indexWhere((t) =>
        t.path == '/' ? location == '/' : location.startsWith(t.path));
    if (selectedIdx < 0) selectedIdx = 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Row(
        children: [
          // ── Left navigation rail ──────────────────────────────────────
          Container(
            width: 68,
            color: railBg,
            child: SafeArea(
              child: Column(
                children: [
                  const SizedBox(height: 18),
                  // ── Logo mark ──
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(LucideIcons.building2, size: 18, color: Colors.white),
                  ),
                  const SizedBox(height: 20),
                  Container(height: 1, margin: const EdgeInsets.symmetric(horizontal: 16), color: Colors.white.withValues(alpha: 0.12)),
                  const SizedBox(height: 12),
                  // ── Nav items ──
                  ...List.generate(_tabs.length, (i) {
                    final tab    = _tabs[i];
                    final active = i == selectedIdx;
                    return Tooltip(
                      message: tab.label,
                      preferBelow: false,
                      waitDuration: const Duration(milliseconds: 400),
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          context.go(tab.path);
                        },
                        child: Container(
                          width: double.infinity,
                          height: 52,
                          margin: const EdgeInsets.symmetric(vertical: 1),
                          decoration: BoxDecoration(
                            color: active
                                ? Colors.white.withValues(alpha: 0.10)
                                : Colors.transparent,
                            border: active
                                ? const Border(
                                    left: BorderSide(color: Colors.white, width: 3),
                                  )
                                : null,
                          ),
                          child: Center(
                            child: Icon(
                              tab.icon,
                              size: 22,
                              color: active ? activeColor : inactiveColor,
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                  const Spacer(),
                  Container(height: 1, margin: const EdgeInsets.symmetric(horizontal: 16), color: Colors.white.withValues(alpha: 0.12)),
                  const SizedBox(height: 12),
                  // ── FAB ──
                  Tooltip(
                    message: 'Neu erstellen',
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.mediumImpact();
                        showQuickAddSheet(context);
                      },
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.25), width: 1),
                        ),
                        child: const Icon(LucideIcons.plus, size: 20, color: Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
          // ── Main content ──────────────────────────────────────────────
          Expanded(child: child),
        ],
      ),
    );
  }
}

// ─── Tab model ───────────────────────────────────────────────────────────────

class _Tab {
  final IconData icon;
  final String label;
  final String path;
  const _Tab({required this.icon, required this.label, required this.path});
}

// ─── Bottom nav bar ──────────────────────────────────────────────────────────

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  static const _leftTabs = [
    _Tab(icon: LucideIcons.layoutGrid, label: 'Projekte', path: '/'),
    _Tab(icon: LucideIcons.helpCircle, label: 'Hilfe', path: '/help'),
  ];
  static const _rightTabs = [
    _Tab(icon: LucideIcons.user, label: 'Profil', path: '/profile'),
    _Tab(icon: LucideIcons.moreHorizontal, label: 'Mehr', path: '/settings'),
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottom = MediaQuery.of(context).padding.bottom;

    final bg = isDark ? const Color(0xFF1C1C1E) : Colors.white;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.40 : 0.08),
            blurRadius: 24,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ..._leftTabs.map((tab) {
                final active = tab.path == '/'
                    ? location == '/'
                    : location.startsWith(tab.path);
                return Expanded(
                  child: _NavItem(
                    icon: tab.icon,
                    label: tab.label,
                    active: active,
                    isDark: isDark,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      context.go(tab.path);
                    },
                  ),
                );
              }),

              // ── Center FAB gap ──
              SizedBox(
                width: 76,
                child: Center(
                  child: _FabButton(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      showQuickAddSheet(context);
                    },
                  ),
                ),
              ),

              ..._rightTabs.map((tab) {
                final active = tab.path == '/'
                    ? location == '/'
                    : location.startsWith(tab.path);
                return Expanded(
                  child: _NavItem(
                    icon: tab.icon,
                    label: tab.label,
                    active: active,
                    isDark: isDark,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      context.go(tab.path);
                    },
                  ),
                );
              }),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(height: bottom),
        ],
      ),
    );
  }
}

// ─── Nav item — pill when active, icon-only when inactive ─────────────────────

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final bool isDark;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = isDark ? const Color(0xFF7C6AF7) : AppColors.primary;
    final inactiveColor =
        isDark ? const Color(0xFF636366) : const Color(0xFF9CA3AF);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: 56,
        child: Center(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: child),
            child: active
                // ── Active: pill with icon + label ──
                ? Container(
                    key: ValueKey('active_$label'),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF7C6AF7).withValues(alpha: 0.18)
                          : AppColors.primary.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(50),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 16, color: activeColor),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            label,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: activeColor,
                              letterSpacing: -0.1,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ),
                      ],
                    ),
                  )
                // ── Inactive: icon only ──
                : Icon(
                    key: ValueKey('inactive_$label'),
                    icon,
                    size: 22,
                    color: inactiveColor,
                  ),

          ),
        ),
      ),
    );
  }
}

// ─── Center FAB ───────────────────────────────────────────────────────────────

class _FabButton extends StatefulWidget {
  final VoidCallback onTap;
  const _FabButton({required this.onTap});

  @override
  State<_FabButton> createState() => _FabButtonState();
}

class _FabButtonState extends State<_FabButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.88)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeIn));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) async {
        await _ctrl.reverse();
        widget.onTap();
      },
      onTapCancel: () => _ctrl.reverse(),
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: isDark
                ? const LinearGradient(
                    colors: [Color(0xFF7C6AF7), Color(0xFF5B50C8)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : const LinearGradient(
                    colors: [Color(0xFF0E2A47), Color(0xFF1E3A5F)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
            boxShadow: [
              BoxShadow(
                color: (isDark
                        ? const Color(0xFF7C6AF7)
                        : AppColors.primary)
                    .withValues(alpha: 0.40),
                blurRadius: 16,
                spreadRadius: 0,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Icon(LucideIcons.plus, size: 26, color: Colors.white),
        ),
      ),
    );
  }
}
