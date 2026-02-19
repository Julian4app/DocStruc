import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../features/project/project_detail_screen.dart';

/// Returns an AppBar `leading` widget that opens the project drawer.
/// Falls back to the default back button if there is no BurgerMenuScope.
Widget? burgerMenuLeading(BuildContext context) {
  final scope = BurgerMenuScope.of(context);
  if (scope?.openDrawer == null) return null;
  return IconButton(
    icon: const Icon(LucideIcons.menu, size: 22),
    onPressed: scope!.openDrawer,
  );
}
