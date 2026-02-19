import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';

class HelpVideosScreen extends StatefulWidget {
  const HelpVideosScreen({super.key});

  @override
  State<HelpVideosScreen> createState() => _HelpVideosScreenState();
}

class _HelpVideosScreenState extends State<HelpVideosScreen> {
  bool _loading = true;
  List<dynamic> _videos = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final v = await SupabaseService.getVideos();
    if (mounted) setState(() { _videos = v; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Video-Tutorials')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _videos.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.playCircle,
                          size: 48, color: AppColors.textTertiary),
                      SizedBox(height: 12),
                      Text('Keine Videos',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _videos.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _VideoCard(_videos[i]),
                ),
    );
  }
}

class _VideoCard extends StatelessWidget {
  final Map<String, dynamic> video;
  const _VideoCard(this.video);

  @override
  Widget build(BuildContext context) {
    final title = video['title'] ?? '';
    final description = video['description'] ?? '';
    final url = video['video_url'] ?? video['url'] ?? '';
    final thumbnailUrl = video['thumbnail_url'];
    final duration = video['duration'];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.hardEdge,
      child: InkWell(
        onTap: () async {
          if (url.isNotEmpty) {
            final uri = Uri.tryParse(url);
            if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        child: Column(
          children: [
            // Thumbnail / placeholder
            Container(
              height: 180,
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.05),
                image: thumbnailUrl != null
                    ? DecorationImage(
                        image: NetworkImage(thumbnailUrl),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: thumbnailUrl == null
                  ? Center(
                      child: Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.9),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.play,
                            size: 28, color: Colors.white),
                      ),
                    )
                  : Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.5),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(LucideIcons.play,
                              size: 28, color: Colors.white),
                        ),
                        if (duration != null)
                          Positioned(
                            bottom: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(duration,
                                  style: const TextStyle(
                                      fontSize: 12, color: Colors.white)),
                            ),
                          ),
                      ],
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(description,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.textSecondary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
