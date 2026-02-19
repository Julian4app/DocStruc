import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/app_colors.dart';

class AppShell extends ConsumerStatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  static const _tabs = [
    _Tab(
      icon: LucideIcons.layoutGrid,
      activeIcon: LucideIcons.layoutGrid,
      label: 'Projekte',
      path: '/',
    ),
    _Tab(
      icon: LucideIcons.helpCircle,
      activeIcon: LucideIcons.helpCircle,
      label: 'Hilfe',
      path: '/help',
    ),
    _Tab(
      icon: LucideIcons.user,
      activeIcon: LucideIcons.user,
      label: 'Profil',
      path: '/profile',
    ),
    _Tab(
      icon: LucideIcons.moreHorizontal,
      activeIcon: LucideIcons.moreHorizontal,
      label: 'Mehr',
      path: '/settings',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: _BottomNav(tabs: _tabs),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final List<_Tab> tabs;
  const _BottomNav({required this.tabs});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            children: tabs.map((tab) {
              final active = tab.path == '/'
                  ? location == '/'
                  : location.startsWith(tab.path);
              return Expanded(
                child: _NavItem(
                  tab: tab,
                  active: active,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    context.go(tab.path);
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final _Tab tab;
  final bool active;
  final VoidCallback onTap;

  const _NavItem({
    required this.tab,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon with animated pill background
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeInOut,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              decoration: BoxDecoration(
                color: active
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                active ? tab.activeIcon : tab.icon,
                size: 22,
                color: active ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 3),
            // Label
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 220),
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                color: active ? AppColors.primary : AppColors.textSecondary,
                letterSpacing: active ? 0.2 : 0,
              ),
              child: Text(tab.label),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tab {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String path;

  const _Tab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
  });
}
