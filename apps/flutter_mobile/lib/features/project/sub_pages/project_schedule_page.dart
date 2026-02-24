import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';
import 'package:docstruc_mobile/core/widgets/lottie_loader.dart';

// ── Helpers ───────────────────────────────────────────────────────────────────

Color _typeColor(String? t) {
  switch (t) {
    case 'deadline': return const Color(0xFFEF4444);
    case 'phase': return const Color(0xFF8B5CF6);
    default: return const Color(0xFF3B82F6); // milestone
  }
}
String _typeLabel(String? t) {
  switch (t) {
    case 'deadline': return 'Deadline';
    case 'phase': return 'Bauphase';
    default: return 'Meilenstein';
  }
}
String _fmt(String? d) {
  if (d == null) return '';
  try { return DateFormat('dd.MM.yyyy').format(DateTime.parse(d)); } catch (_) { return d; }
}
Color _progressColor(int pct) {
  if (pct <= 50) {
    final t = pct / 50.0;
    return Color.fromARGB(255, 239, (103 + (144 * t).round()).clamp(0,255), 68);
  } else {
    final t = (pct - 50) / 50.0;
    return Color.fromARGB(255, (239 - (195 * t)).round().clamp(0,255), (167 + (61 * t).round()).clamp(0,255), 68);
  }
}

String _taskStatusLabel(String? s) {
  switch (s) {
    case 'done': return 'Erledigt';
    case 'in_progress': return 'In Bearb.';
    case 'review': return 'Review';
    case 'open': return 'Offen';
    default: return s ?? '';
  }
}
Color _taskStatusColor(String? s) {
  switch (s) {
    case 'done': return AppColors.success;
    case 'in_progress': return AppColors.warning;
    case 'review': return const Color(0xFF8B5CF6);
    case 'open': return AppColors.danger;
    case 'resolved': return AppColors.success;
    default: return AppColors.textTertiary;
  }
}
String _priorityLabel(String? p) {
  switch (p) { case 'critical': return 'Kritisch'; case 'high': return 'Hoch'; case 'low': return 'Niedrig'; default: return 'Mittel'; }
}
Color _priorityColor(String? p) {
  switch (p) { case 'critical': return const Color(0xFFEF4444); case 'high': return const Color(0xFFF97316); case 'low': return const Color(0xFF64748B); default: return const Color(0xFF3B82F6); }
}

// ── Page ─────────────────────────────────────────────────────────────────────

class ProjectSchedulePage extends StatefulWidget {
  final String projectId;
  const ProjectSchedulePage({super.key, required this.projectId});
  @override State<ProjectSchedulePage> createState() => _ProjectSchedulePageState();
}

class _ProjectSchedulePageState extends State<ProjectSchedulePage> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  bool _loading = true;
  List<Map<String,dynamic>> _milestones = [];
  List<Map<String,dynamic>> _allTasks = [];
  String? _projectStart, _projectEnd;
  String _scheduleStatus = 'unknown';
  DateTime _calMonth = DateTime.now();

  // Search
  bool _searchOpen = false;
  String _search = '';
  final _searchCtrl = TextEditingController();
  final _searchFocusNode = FocusNode();

  @override void initState() { super.initState(); _tabs = TabController(length:3,vsync:this); _load(); }
  @override void dispose() { _tabs.dispose(); _searchCtrl.dispose(); _searchFocusNode.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await Future.wait([
        SupabaseService.getTimelineEvents(widget.projectId),
        SupabaseService.getProjectDates(widget.projectId),
        SupabaseService.getTasks(widget.projectId),
      ]);
      final raw = (r[0] as List).cast<Map<String,dynamic>>();
      final dates = r[1] as Map<String,dynamic>?;
      final tasks = (r[2] as List).cast<Map<String,dynamic>>();
      final withItems = await Future.wait(raw.map((m) async {
        final items = await SupabaseService.getMilestoneTasks(m['id'] as String);
        return {...m, 'linkedItems': items};
      }));
      final start = dates?['start_date'] as String?;
      final end = dates?['target_end_date'] as String?;
      if (mounted) setState(() {
        _milestones = withItems.toList();
        _allTasks = tasks;
        _projectStart = start;
        _projectEnd = end;
        _scheduleStatus = _calcStatus(withItems.toList(), start, end);
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  String _calcStatus(List<Map<String,dynamic>> ms, String? start, String? end) {
    if (ms.isEmpty) return 'unknown';
    final now = DateTime.now();
    final total = ms.length;
    final completed = ms.where((m) => m['status']=='completed').length;
    if (total == 0) return 'unknown';
    final pct = completed / total;
    if (end != null) {
      final endDate = DateTime.tryParse(end);
      if (endDate != null && start != null) {
        final startDate = DateTime.tryParse(start) ?? now;
        final totalDays = endDate.difference(startDate).inDays;
        if (totalDays > 0) {
          final elapsed = now.difference(startDate).inDays;
          final expected = elapsed / totalDays;
          if (pct >= expected + 0.1) return 'ahead';
          if (pct < expected - 0.1) return 'behind';
        }
      }
    }
    return 'on_track';
  }

  Future<void> _toggleMilestone(Map<String,dynamic> m) async {
    final id = m['id'] as String;
    // DB allows: 'scheduled', 'in_progress', 'completed', 'cancelled'
    // Use 'scheduled' when resetting from completed
    final currentStatus = m['status'] as String?;
    final newStatus = currentStatus == 'completed' ? 'scheduled' : 'completed';
    // Optimistically update local state immediately so sheets see it
    if (mounted) {
      setState(() {
        final idx = _milestones.indexWhere((x) => x['id'] == id);
        if (idx != -1) {
          _milestones[idx] = {..._milestones[idx], 'status': newStatus};
        }
      });
    }
    try {
      await SupabaseService.updateTimelineEvent(id, {'status': newStatus});
    } catch (e) {
      // Revert on failure
      if (mounted) {
        setState(() {
          final idx = _milestones.indexWhere((x) => x['id'] == id);
          if (idx != -1) {
            _milestones[idx] = {..._milestones[idx], 'status': currentStatus};
          }
        });
      }
    }
    // No _load() here — optimistic update already reflects the new state.
    // Calling _load() without await created a race condition that could
    // re-read the old DB status before the write committed.
  }

  List<Map<String,dynamic>> get _filteredMilestones {
    if (_search.isEmpty) return _milestones;
    final q = _search.toLowerCase();
    return _milestones.where((m) =>
      (m['title'] as String? ?? '').toLowerCase().contains(q) ||
      (m['description'] as String? ?? '').toLowerCase().contains(q),
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: burgerMenuLeading(context),
        title: const Text('Zeitplan'),
        bottom: TabBar(controller: _tabs, tabs: const [
          Tab(text: 'Liste'), Tab(text: 'Timeline'), Tab(text: 'Kalender'),
        ]),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateSheet(context),
        backgroundColor: AppColors.primary,
        child: const Icon(LucideIcons.plus, color: Colors.white),
      ),
      body: _loading ? const LottieLoader()
        : TabBarView(controller: _tabs, children: [
          _listTab(),
          _timelineTab(),
          _calendarTab(),
        ]),
    );
  }

  // ── Overview Card ──────────────────────────────────────────────────────────
  Widget _overviewCard() {
    final total = _milestones.length;
    final completed = _milestones.where((m) => m['status']=='completed').length;
    final pct = total > 0 ? (completed / total * 100).round() : 0;
    Color statusColor; String statusLabel;
    switch (_scheduleStatus) {
      case 'ahead': statusColor = const Color(0xFF3B82F6); statusLabel = 'Vor dem Zeitplan'; break;
      case 'behind': statusColor = AppColors.danger; statusLabel = 'Hinter dem Zeitplan'; break;
      default: statusColor = AppColors.success; statusLabel = 'Im Zeitplan';
    }
    return Container(
      margin: const EdgeInsets.fromLTRB(16,12,16,0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color:AppColors.surface, borderRadius:BorderRadius.circular(16), border:Border.all(color:AppColors.border)),
      child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[
        Row(children:[
          const Icon(LucideIcons.calendar, size:16, color:AppColors.textTertiary),
          const SizedBox(width:6),
          const Text('Zeitplan-Übersicht', style:TextStyle(fontSize:14,fontWeight:FontWeight.w700,color:AppColors.text)),
          const Spacer(),
          Container(padding:const EdgeInsets.symmetric(horizontal:8,vertical:3),
            decoration:BoxDecoration(color:statusColor.withValues(alpha:0.12),borderRadius:BorderRadius.circular(8)),
            child:Text(statusLabel,style:TextStyle(fontSize:11,fontWeight:FontWeight.w600,color:statusColor))),
        ]),
        const SizedBox(height:12),
        Row(children:[
          Expanded(child:_overviewItem(LucideIcons.calendarCheck,'Start',_projectStart!=null?_fmt(_projectStart):'-')),
          Expanded(child:_overviewItem(LucideIcons.calendarX,'Ende',_projectEnd!=null?_fmt(_projectEnd):'-')),
          Expanded(child:_overviewItem(LucideIcons.checkCircle,'Fertig','$completed/$total')),
        ]),
        const SizedBox(height:12),
        Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[
          Text('Fortschritt', style:const TextStyle(fontSize:12,color:AppColors.textSecondary)),
          Text('$pct%', style:TextStyle(fontSize:12,fontWeight:FontWeight.w600,color:_progressColor(pct))),
        ]),
        const SizedBox(height:6),
        ClipRRect(borderRadius:BorderRadius.circular(4), child:LinearProgressIndicator(
          value: total>0?completed/total:0, minHeight:8,
          backgroundColor:AppColors.border,
          valueColor:AlwaysStoppedAnimation(_progressColor(pct)),
        )),
      ]),
    );
  }
  Widget _overviewItem(IconData icon, String label, String val) => Column(children:[
    Icon(icon,size:18,color:AppColors.textTertiary),
    const SizedBox(height:4),
    Text(val,style:const TextStyle(fontSize:13,fontWeight:FontWeight.w700,color:AppColors.text)),
    Text(label,style:const TextStyle(fontSize:11,color:AppColors.textTertiary)),
  ]);

  // ── Stats Row ──────────────────────────────────────────────────────────────
  Widget _statsRow() {
    final total = _milestones.length;
    final completed = _milestones.where((m) => m['status']=='completed').length;
    final open = _milestones.where((m) => m['status']!='completed').length;
    return Padding(padding:const EdgeInsets.fromLTRB(16,10,16,0),child:Row(children:[
      _stat('Meilensteine','$total',AppColors.textSecondary),
      const SizedBox(width:8),
      _stat('Abgeschlossen','$completed',AppColors.success),
      const SizedBox(width:8),
      _stat('Offen','$open',AppColors.warning),
    ]));
  }
  Widget _stat(String l, String v, Color c) => Expanded(child:Container(
    padding:const EdgeInsets.symmetric(vertical:8),
    decoration:BoxDecoration(color:AppColors.surface,borderRadius:BorderRadius.circular(10),border:Border.all(color:AppColors.border)),
    child:Column(children:[Text(v,style:TextStyle(fontSize:16,fontWeight:FontWeight.w800,color:c)),Text(l,style:const TextStyle(fontSize:10,color:AppColors.textSecondary))]),
  ));

  // ── Search bar ─────────────────────────────────────────────────────────────
  Widget _searchBar() {
    return Column(mainAxisSize:MainAxisSize.min, children:[
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        child: Row(children: [
          Expanded(
            child: const Text('Meilensteine', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
          ),
          GestureDetector(
            onTap: () {
              setState(() {
                _searchOpen = !_searchOpen;
                if (_searchOpen) {
                  Future.microtask(() => _searchFocusNode.requestFocus());
                } else {
                  _searchCtrl.clear();
                  _search = '';
                  _searchFocusNode.unfocus();
                }
              });
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _searchOpen
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _searchOpen
                      ? AppColors.primary.withValues(alpha: 0.4)
                      : AppColors.border,
                ),
              ),
              child: Icon(
                _searchOpen ? LucideIcons.x : LucideIcons.search,
                size: 17,
                color: _searchOpen ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
          ),
        ]),
      ),
      AnimatedSize(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        child: _searchOpen
            ? Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _searchCtrl,
                  focusNode: _searchFocusNode,
                  onChanged: (v) => setState(() => _search = v),
                  style: const TextStyle(fontSize: 14, color: AppColors.text),
                  decoration: InputDecoration(
                    hintText: 'Meilensteine durchsuchen…',
                    hintStyle: const TextStyle(fontSize: 13),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    prefixIcon: const Icon(LucideIcons.search, size: 16),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(
                            icon: const Icon(LucideIcons.x, size: 16),
                            onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); },
                          )
                        : null,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary)),
                  ),
                ),
              )
            : const SizedBox.shrink(),
      ),
    ]);
  }

  // ── LIST TAB ──────────────────────────────────────────────────────────────
  Widget _listTab() {
    final filtered = _filteredMilestones;
    return RefreshIndicator(onRefresh:_load, child:ListView(
      children:[
        _overviewCard(),
        _statsRow(),
        const SizedBox(height:4),
        _searchBar(),
        const SizedBox(height:8),
        if(filtered.isEmpty) Padding(padding:const EdgeInsets.all(32),child:Center(child:Column(children:[
          Icon(_search.isNotEmpty ? LucideIcons.searchX : LucideIcons.calendar, size:48,color:AppColors.textTertiary),
          const SizedBox(height:12),
          Text(_search.isNotEmpty ? 'Keine Treffer' : 'Noch keine Meilensteine', style:const TextStyle(fontSize:15,color:AppColors.textSecondary)),
        ])))
        else ...filtered.map((m)=>_MilestoneListCard(
          m:m,
          onToggle:() => _toggleMilestone(m),
          onTap:()=>_showDetail(context,m),
          onEdit:()=>_showCreateSheet(context,milestone:m),
          onDelete:()=>_deleteMilestone(m),
        )),

        const SizedBox(height:100),
      ],
    ));
  }

  // ── TIMELINE TAB ──────────────────────────────────────────────────────────
  Widget _timelineTab() {
    return RefreshIndicator(onRefresh:_load, child:ListView(
      children:[
        _overviewCard(),
        const SizedBox(height:16),
        Padding(padding:const EdgeInsets.symmetric(horizontal:16,vertical:4),child:const Text('Zeitlinie',style:TextStyle(fontSize:16,fontWeight:FontWeight.w700,color:AppColors.text))),
        if(_milestones.isEmpty) Padding(padding:const EdgeInsets.all(32),child:Center(child:Column(children:const[Icon(LucideIcons.calendar,size:48,color:AppColors.textTertiary),SizedBox(height:12),Text('Noch keine Meilensteine',style:TextStyle(fontSize:15,color:AppColors.textSecondary))])))
        else ..._milestones.asMap().entries.map((e){
          final idx=e.key; final m=e.value;
          return _TimelineCard(m:m, isLast:idx==_milestones.length-1, onTap:()=>_showDetail(context,m));
        }),
        const SizedBox(height:100),
      ],
    ));
  }

  // ── CALENDAR TAB ──────────────────────────────────────────────────────────
  Widget _calendarTab() {
    return ListView(children:[
      _buildCalendar(),
      const SizedBox(height:100),
    ]);
  }

  Widget _buildCalendar() {
    final firstDay = DateTime(_calMonth.year,_calMonth.month,1);
    final daysInMonth = DateUtils.getDaysInMonth(_calMonth.year,_calMonth.month);
    final startWeekday = firstDay.weekday % 7;
    final Map<int,List<Map<String,dynamic>>> byDay={};
    for(final m in _milestones){
      final ds=m['start_date'] as String?; if(ds==null) continue;
      final dt=DateTime.tryParse(ds); if(dt==null) continue;
      if(dt.year==_calMonth.year&&dt.month==_calMonth.month){ byDay.putIfAbsent(dt.day,()=>[]).add(m); }
    }
    return Column(children:[
      Container(padding:const EdgeInsets.fromLTRB(16,16,16,8),child:Row(children:[
        IconButton(icon:const Icon(LucideIcons.chevronLeft),onPressed:()=>setState(()=>_calMonth=DateTime(_calMonth.year,_calMonth.month-1,1))),
        Expanded(child:Center(child:Text(DateFormat('MMMM yyyy','de').format(_calMonth),style:const TextStyle(fontSize:16,fontWeight:FontWeight.w700,color:AppColors.text)))),
        IconButton(icon:const Icon(LucideIcons.chevronRight),onPressed:()=>setState(()=>_calMonth=DateTime(_calMonth.year,_calMonth.month+1,1))),
      ])),
      Padding(padding:const EdgeInsets.symmetric(horizontal:16),child:Row(children:['Mo','Di','Mi','Do','Fr','Sa','So'].map((d)=>Expanded(child:Center(child:Text(d,style:const TextStyle(fontSize:12,fontWeight:FontWeight.w600,color:AppColors.textTertiary))))).toList())),
      const SizedBox(height:8),
      Padding(padding:const EdgeInsets.symmetric(horizontal:12),child:GridView.builder(
        shrinkWrap:true, physics:const NeverScrollableScrollPhysics(),
        gridDelegate:const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount:7,childAspectRatio:1,crossAxisSpacing:2,mainAxisSpacing:2),
        itemCount:startWeekday+daysInMonth,
        itemBuilder:(ctx,i){
          if(i<startWeekday) return const SizedBox();
          final day=i-startWeekday+1; final items=byDay[day];
          final today=DateTime.now(); final isToday=today.year==_calMonth.year&&today.month==_calMonth.month&&today.day==day;
          return GestureDetector(
            onTap:items!=null?()=>_showCalDaySheet(ctx,day,items):null,
            child:Container(
              decoration:BoxDecoration(
                color:isToday?AppColors.primary.withValues(alpha:0.15):items!=null?AppColors.surface:Colors.transparent,
                borderRadius:BorderRadius.circular(8),
                border:isToday?Border.all(color:AppColors.primary,width:1.5):null,
              ),
              child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[
                Text('$day',style:TextStyle(fontSize:13,fontWeight:isToday?FontWeight.w700:FontWeight.w500,color:isToday?AppColors.primary:AppColors.text)),
                if(items!=null&&items.isNotEmpty) Row(mainAxisAlignment:MainAxisAlignment.center,children:items.take(3).map((m)=>Container(margin:const EdgeInsets.symmetric(horizontal:1),width:6,height:6,decoration:BoxDecoration(color:_typeColor(m['event_type'] as String?),shape:BoxShape.circle))).toList()),
              ]),
            ),
          );
        },
      )),
      const SizedBox(height:16),
      Padding(padding:const EdgeInsets.symmetric(horizontal:16),child:Wrap(spacing:16,runSpacing:8,children:[
        _calLegend('Meilenstein',const Color(0xFF3B82F6)),
        _calLegend('Deadline',const Color(0xFFEF4444)),
        _calLegend('Bauphase',const Color(0xFF8B5CF6)),
      ])),
    ]);
  }
  Widget _calLegend(String l, Color c) => Row(mainAxisSize:MainAxisSize.min,children:[Container(width:10,height:10,decoration:BoxDecoration(color:c,shape:BoxShape.circle)),const SizedBox(width:4),Text(l,style:const TextStyle(fontSize:12,color:AppColors.textSecondary))]);

  void _showCalDaySheet(BuildContext ctx, int day, List<Map<String,dynamic>> items) {
    showModalBottomSheet(context:ctx,backgroundColor:Colors.transparent,builder:(_)=>Container(
      decoration:const BoxDecoration(color:AppColors.surface,borderRadius:BorderRadius.vertical(top:Radius.circular(20))),
      child:Column(mainAxisSize:MainAxisSize.min,children:[
        Padding(padding:const EdgeInsets.only(top:12),child:Container(width:40,height:4,decoration:BoxDecoration(color:AppColors.border,borderRadius:BorderRadius.circular(2)))),
        Padding(padding:const EdgeInsets.all(16),child:Text('$day. ${DateFormat('MMMM yyyy','de').format(_calMonth)}',style:const TextStyle(fontSize:16,fontWeight:FontWeight.w700,color:AppColors.text))),
        ...items.map((m)=>ListTile(
          leading:Container(width:12,height:12,decoration:BoxDecoration(color:_typeColor(m['event_type'] as String?),shape:BoxShape.circle)),
          title:Text(m['title']??'',style:const TextStyle(fontSize:14,fontWeight:FontWeight.w600)),
          subtitle:Text(_typeLabel(m['event_type'] as String?)),
          onTap:(){Navigator.pop(ctx);_showDetail(ctx,m);},
        )),
        const SizedBox(height:16),
      ]),
    ));
  }

  // ── Milestone Detail Sheet ─────────────────────────────────────────────────
  void _showDetail(BuildContext ctx, Map<String,dynamic> m) {
    // Use StatefulBuilder so isCompleted reflects live _milestones state
    showModalBottomSheet(context:ctx, isScrollControlled:true, backgroundColor:Colors.transparent,
      builder:(sheetCtx)=>StatefulBuilder(
        builder:(sheetCtx, ss) {
          // Always look up the latest data from _milestones
          final current = _milestones.firstWhere((x) => x['id'] == m['id'], orElse: () => m);
          final linkedItems = (current['linkedItems'] as List?)?.cast<Map<String,dynamic>>() ?? [];
          final tc = _typeColor(current['event_type'] as String?);
          final isCompleted = current['status']=='completed';

          return Container(
            constraints:BoxConstraints(maxHeight:MediaQuery.of(ctx).size.height*0.88),
            decoration:const BoxDecoration(color:AppColors.surface,borderRadius:BorderRadius.vertical(top:Radius.circular(20))),
            child:Column(mainAxisSize:MainAxisSize.min,children:[
              Padding(padding:const EdgeInsets.only(top:12),child:Container(width:40,height:4,decoration:BoxDecoration(color:AppColors.border,borderRadius:BorderRadius.circular(2)))),
              Expanded(child:ListView(padding:const EdgeInsets.fromLTRB(20,12,20,24),children:[
                Row(children:[
                  Container(width:14,height:14,decoration:BoxDecoration(color:tc,shape:BoxShape.circle)),
                  const SizedBox(width:10),
                  Expanded(child:Text(current['title']??'',style:const TextStyle(fontSize:18,fontWeight:FontWeight.w700,color:AppColors.text))),
                  Container(padding:const EdgeInsets.symmetric(horizontal:8,vertical:3),decoration:BoxDecoration(color:tc.withValues(alpha:0.12),borderRadius:BorderRadius.circular(8)),child:Text(_typeLabel(current['event_type'] as String?),style:TextStyle(fontSize:11,fontWeight:FontWeight.w600,color:tc))),
                ]),
                const SizedBox(height:12),
                if(current['description']!=null&&(current['description'] as String).isNotEmpty)...[
                  Text(current['description'] as String,style:const TextStyle(fontSize:14,color:AppColors.textSecondary)),
                  const SizedBox(height:12),
                ],
                Row(children:[
                  const Icon(LucideIcons.calendar,size:14,color:AppColors.textTertiary),const SizedBox(width:6),
                  Text(_fmt(current['start_date'] as String?),style:const TextStyle(fontSize:13,color:AppColors.textSecondary)),
                  if(current['end_date']!=null)...[const Text(' – ',style:TextStyle(color:AppColors.textTertiary)),Text(_fmt(current['end_date'] as String?),style:const TextStyle(fontSize:13,color:AppColors.textSecondary))],
                ]),
                if(isCompleted)...[
                  const SizedBox(height:8),
                  Container(padding:const EdgeInsets.symmetric(horizontal:10,vertical:5),decoration:BoxDecoration(color:AppColors.success.withValues(alpha:0.12),borderRadius:BorderRadius.circular(8)),child:const Text('Abgeschlossen',style:TextStyle(fontSize:12,fontWeight:FontWeight.w600,color:AppColors.success))),
                ],
                const SizedBox(height:16),
                if(linkedItems.isNotEmpty)...[
                  const Text('Verknüpfte Aufgaben & Mängel',style:TextStyle(fontSize:14,fontWeight:FontWeight.w600,color:AppColors.text)),
                  const SizedBox(height:8),
                  ...linkedItems.map((li) {
                    final isDefect = li['task_type']=='defect';
                    return GestureDetector(
                      onTap: () {
                        Navigator.pop(sheetCtx);
                        // Navigate to task or defect detail
                        _openLinkedItem(ctx, li);
                      },
                      child: Container(
                        margin:const EdgeInsets.only(bottom:8),
                        padding:const EdgeInsets.all(12),
                        decoration:BoxDecoration(color:AppColors.background,borderRadius:BorderRadius.circular(10),border:Border.all(color:AppColors.border)),
                        child:Row(children:[
                          Container(width:8,height:8,decoration:BoxDecoration(color:_taskStatusColor(li['status'] as String?),shape:BoxShape.circle)),
                          const SizedBox(width:8),
                          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
                            Text(li['title']??'',style:const TextStyle(fontSize:13,fontWeight:FontWeight.w600,color:AppColors.text),maxLines:1,overflow:TextOverflow.ellipsis),
                            Row(children:[
                              Container(padding:const EdgeInsets.symmetric(horizontal:6,vertical:2),margin:const EdgeInsets.only(top:2),decoration:BoxDecoration(color:_taskStatusColor(li['status'] as String?).withValues(alpha:0.1),borderRadius:BorderRadius.circular(4)),child:Text(_taskStatusLabel(li['status'] as String?),style:TextStyle(fontSize:10,color:_taskStatusColor(li['status'] as String?)))),
                              const SizedBox(width:6),
                              if(isDefect) Container(padding:const EdgeInsets.symmetric(horizontal:6,vertical:2),margin:const EdgeInsets.only(top:2),decoration:BoxDecoration(color:_priorityColor(li['priority'] as String?).withValues(alpha:0.1),borderRadius:BorderRadius.circular(4)),child:Text(_priorityLabel(li['priority'] as String?),style:TextStyle(fontSize:10,color:_priorityColor(li['priority'] as String?)))),
                            ]),
                          ])),
                          Icon(isDefect?LucideIcons.alertTriangle:LucideIcons.checkSquare,size:14,color:AppColors.primary),
                          const SizedBox(width:4),
                          const Icon(LucideIcons.chevronRight,size:14,color:AppColors.textTertiary),
                        ]),
                      ),
                    );
                  }),
                ],
                const SizedBox(height:16),
                Row(children:[
                  Expanded(child:OutlinedButton.icon(icon:const Icon(LucideIcons.edit2,size:15),label:const Text('Bearbeiten'),onPressed:(){Navigator.pop(sheetCtx);_showCreateSheet(ctx,milestone:current);})),
                  const SizedBox(width:8),
                  Expanded(child:ElevatedButton.icon(
                    icon:Icon(isCompleted?LucideIcons.rotateCcw:LucideIcons.check,size:15),
                    label:Text(isCompleted?'Öffnen':'Abschließen'),
                    style: isCompleted ? ElevatedButton.styleFrom(backgroundColor: AppColors.warning) : null,
                    onPressed:() async {
                      await _toggleMilestone(current);
                      // Refresh sheet state so it shows updated status
                      if (sheetCtx.mounted) ss(() {});
                    },
                  )),
                ]),
                const SizedBox(height:8),
                SizedBox(width:double.infinity,child:TextButton.icon(icon:const Icon(LucideIcons.trash2,size:15,color:AppColors.danger),label:const Text('Löschen',style:TextStyle(color:AppColors.danger)),onPressed:(){Navigator.pop(sheetCtx);_deleteMilestone(current);})),
              ])),
            ]),
          );
        }
      ),
    );
  }

  void _openLinkedItem(BuildContext ctx, Map<String,dynamic> li) {
    final isDefect = li['task_type'] == 'defect';
    final statusColor = _taskStatusColor(li['status'] as String?);
    final priorityColor = _priorityColor(li['priority'] as String?);
    final typeColor = isDefect ? priorityColor : AppColors.primary;

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(padding: const EdgeInsets.only(top: 12), child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
          Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 16, 20, 40), children: [
            // Type + Status badges
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(isDefect ? LucideIcons.alertTriangle : LucideIcons.checkSquare, size: 13, color: typeColor),
                  const SizedBox(width: 5),
                  Text(isDefect ? 'Mangel' : 'Aufgabe', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: typeColor)),
                ]),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Text(_taskStatusLabel(li['status'] as String?), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ]),
            const SizedBox(height: 16),
            // Title
            Text(li['title'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
            // Description
            if ((li['description'] as String?)?.isNotEmpty ?? false) ...[const SizedBox(height: 10), Text(li['description'] as String, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5))],
            const SizedBox(height: 20),
            // Info cards
            Container(
              decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
              child: Column(children: [
                if (isDefect && li['priority'] != null) ...[_liDetailTile(LucideIcons.flag, 'Priorität', _priorityLabel(li['priority'] as String?), priorityColor), const Divider(height: 1)],
                _liDetailTile(LucideIcons.activity, 'Status', _taskStatusLabel(li['status'] as String?), statusColor),
                if (li['due_date'] != null) ...[const Divider(height: 1), _liDetailTile(LucideIcons.calendar, 'Fälligkeitsdatum', _fmt(li['due_date'] as String?), AppColors.textSecondary)],
                if ((li['location'] as String?)?.isNotEmpty ?? false) ...[const Divider(height: 1), _liDetailTile(LucideIcons.mapPin, 'Ort / Bereich', li['location'] as String, AppColors.textSecondary)],
                if (!isDefect && li['story_points'] != null) ...[const Divider(height: 1), _liDetailTile(LucideIcons.zap, 'Story Points', '${li['story_points']} SP', AppColors.primary)],
                if (!isDefect && li['assigned_to'] != null) ...[const Divider(height: 1), _liDetailTile(LucideIcons.user, 'Zugewiesen an', li['assigned_to'] as String, AppColors.textSecondary)],
              ]),
            ),
            const SizedBox(height: 20),
            // Priority bar (visual) for defects
            if (isDefect) Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: priorityColor.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12), border: Border.all(color: priorityColor.withValues(alpha: 0.2))),
              child: Row(children: [
                Icon(LucideIcons.flag, size: 16, color: priorityColor),
                const SizedBox(width: 10),
                Text('Priorität: ', style: TextStyle(fontSize: 13, color: priorityColor.withValues(alpha: 0.7))),
                Text(_priorityLabel(li['priority'] as String?), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: priorityColor)),
              ]),
            ),
          ])),
        ]),
      ),
    );
  }

  Widget _liDetailTile(IconData icon, String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(children: [
        Container(width: 32, height: 32, decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 15, color: color)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textTertiary)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text)),
        ])),
      ]),
    );
  }

  Future<void> _deleteMilestone(Map<String,dynamic> m) async {
    final ok=await showDialog<bool>(context:context,builder:(_)=>AlertDialog(title:const Text('Meilenstein löschen'),content:const Text('Wirklich löschen?'),actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Nein')),TextButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Löschen',style:TextStyle(color:AppColors.danger)))]));
    if(ok!=true) return;
    await SupabaseService.deleteTimelineEvent(m['id'] as String);
    _load();
  }

  // ── Create / Edit Sheet ────────────────────────────────────────────────────
  void _showCreateSheet(BuildContext ctx, {Map<String,dynamic>? milestone}) {
    final isEdit = milestone!=null;
    final titleCtrl = TextEditingController(text:isEdit?milestone['title']??'':'');
    final descCtrl = TextEditingController(text:isEdit?milestone['description']??'':'');
    String eventType = isEdit?milestone['event_type']??'milestone':'milestone';
    String color = isEdit?milestone['color']??'#3B82F6':'#3B82F6';
    DateTime? startDate = isEdit&&milestone['start_date']!=null?DateTime.tryParse(milestone['start_date'] as String):null;
    DateTime? endDate = isEdit&&milestone['end_date']!=null?DateTime.tryParse(milestone['end_date'] as String):null;
    List<String> linkedTaskIds = [];
    final preLinked = (milestone?['linkedItems'] as List?)?.cast<Map<String,dynamic>>() ?? [];
    for(final li in preLinked) { final id=li['id'] as String?; if(id!=null) linkedTaskIds.add(id); }

    final presetColors = ['#3B82F6','#EF4444','#10B981','#F97316','#8B5CF6','#64748B'];
    showModalBottomSheet(context:ctx,isScrollControlled:true,backgroundColor:Colors.transparent,
      builder:(ctx2)=>StatefulBuilder(builder:(ctx2,ss)=>Container(
        constraints:BoxConstraints(maxHeight:MediaQuery.of(ctx2).size.height*0.95),
        decoration:const BoxDecoration(color:AppColors.surface,borderRadius:BorderRadius.vertical(top:Radius.circular(20))),
        child:Column(mainAxisSize:MainAxisSize.min,children:[
          Padding(padding:const EdgeInsets.only(top:12),child:Container(width:40,height:4,decoration:BoxDecoration(color:AppColors.border,borderRadius:BorderRadius.circular(2)))),
          Expanded(child:ListView(padding:EdgeInsets.fromLTRB(20,16,20,MediaQuery.of(ctx2).viewInsets.bottom+24),children:[
            Text(isEdit?'Meilenstein bearbeiten':'Neuer Meilenstein',style:const TextStyle(fontSize:20,fontWeight:FontWeight.w700,color:AppColors.text)),
            const SizedBox(height:20),
            TextField(controller:titleCtrl,decoration:const InputDecoration(labelText:'Titel *')),
            const SizedBox(height:14),
            TextField(controller:descCtrl,maxLines:3,decoration:const InputDecoration(labelText:'Beschreibung')),
            const SizedBox(height:18),
            const Text('Typ',style:TextStyle(fontSize:14,fontWeight:FontWeight.w600,color:AppColors.text)),
            const SizedBox(height:8),
            Row(children:[
              _typeBtn(ss,'milestone','Meilenstein',eventType,(v)=>eventType=v),
              const SizedBox(width:8),
              _typeBtn(ss,'deadline','Deadline',eventType,(v)=>eventType=v),
              const SizedBox(width:8),
              _typeBtn(ss,'phase','Bauphase',eventType,(v)=>eventType=v),
            ]),
            const SizedBox(height:18),
            const Text('Farbe',style:TextStyle(fontSize:14,fontWeight:FontWeight.w600,color:AppColors.text)),
            const SizedBox(height:8),
            Row(children:presetColors.map((c){final sel=color==c;final co=_hexColor(c);return GestureDetector(onTap:()=>ss(()=>color=c),child:Container(margin:const EdgeInsets.only(right:8),width:34,height:34,decoration:BoxDecoration(color:co,shape:BoxShape.circle,border:sel?Border.all(color:Colors.white,width:2):null,boxShadow:sel?[BoxShadow(color:co.withValues(alpha:0.6),blurRadius:6,spreadRadius:2)]:null)));}).toList()),
            const SizedBox(height:18),
            GestureDetector(onTap:() async{final p=await showDatePicker(context:ctx2,initialDate:startDate??DateTime.now(),firstDate:DateTime(2020),lastDate:DateTime(2030));if(p!=null)ss(()=>startDate=p);},
              child:Container(padding:const EdgeInsets.symmetric(horizontal:14,vertical:14),decoration:BoxDecoration(color:AppColors.background,borderRadius:BorderRadius.circular(10),border:Border.all(color:startDate!=null?AppColors.primary:AppColors.border)),child:Row(children:[Icon(LucideIcons.calendar,size:16,color:startDate!=null?AppColors.primary:AppColors.textSecondary),const SizedBox(width:10),Text(startDate!=null?_fmt(startDate!.toIso8601String()):'Startdatum * wählen',style:TextStyle(fontSize:14,color:startDate!=null?AppColors.text:AppColors.textSecondary))]))),
            const SizedBox(height:12),
            GestureDetector(onTap:() async{final p=await showDatePicker(context:ctx2,initialDate:endDate??startDate??DateTime.now().add(const Duration(days:7)),firstDate:DateTime(2020),lastDate:DateTime(2030));if(p!=null)ss(()=>endDate=p);},
              child:Container(padding:const EdgeInsets.symmetric(horizontal:14,vertical:14),decoration:BoxDecoration(color:AppColors.background,borderRadius:BorderRadius.circular(10),border:Border.all(color:endDate!=null?AppColors.primary:AppColors.border)),child:Row(children:[Icon(LucideIcons.calendar,size:16,color:endDate!=null?AppColors.primary:AppColors.textSecondary),const SizedBox(width:10),Text(endDate!=null?_fmt(endDate!.toIso8601String()):'Enddatum wählen',style:TextStyle(fontSize:14,color:endDate!=null?AppColors.text:AppColors.textSecondary)),const Spacer(),if(endDate!=null) GestureDetector(onTap:()=>ss(()=>endDate=null),child:const Icon(LucideIcons.x,size:16,color:AppColors.textSecondary))]))),
            const SizedBox(height:18),
            const Text('Verknüpfte Aufgaben & Mängel',style:TextStyle(fontSize:14,fontWeight:FontWeight.w600,color:AppColors.text)),
            const SizedBox(height:6),
            const Text('Tippen um auszuwählen',style:TextStyle(fontSize:12,color:AppColors.textTertiary)),
            const SizedBox(height:8),
            ..._allTasks.map((t){
              final id=t['id'] as String; final linked=linkedTaskIds.contains(id);
              return CheckboxListTile(
                dense:true, contentPadding:const EdgeInsets.symmetric(horizontal:4),
                value:linked, title:Text(t['title']??'',style:const TextStyle(fontSize:13)),
                secondary:Icon(t['task_type']=='defect'?LucideIcons.alertTriangle:LucideIcons.checkSquare,size:14,color:AppColors.textTertiary),
                onChanged:(v){ss((){if(v==true){if(!linkedTaskIds.contains(id))linkedTaskIds.add(id);}else{linkedTaskIds.remove(id);}});},
              );
            }),
            const SizedBox(height:24),
            SizedBox(width:double.infinity,child:ElevatedButton(
              onPressed:() async {
                if(titleCtrl.text.trim().isEmpty||startDate==null) {
                  ScaffoldMessenger.of(ctx2).showSnackBar(const SnackBar(content:Text('Titel und Startdatum sind Pflichtfelder')));
                  return;
                }
                final data={
                  'title':titleCtrl.text.trim(),'description':descCtrl.text.trim(),
                  'event_type':eventType,'color':color,
                  'start_date':startDate!.toIso8601String().split('T')[0],
                  if(endDate!=null)'end_date':endDate!.toIso8601String().split('T')[0],
                };
                if(isEdit){
                  await SupabaseService.updateTimelineEvent(milestone['id'] as String,data);
                  await SupabaseService.replaceAllMilestoneTasks(milestone['id'] as String,linkedTaskIds);
                }else{
                  await SupabaseService.createTimelineEvent(widget.projectId,data);
                  final events=await SupabaseService.getTimelineEvents(widget.projectId);
                  if(events.isNotEmpty&&linkedTaskIds.isNotEmpty){
                    final newId=events.last['id'] as String;
                    await SupabaseService.replaceAllMilestoneTasks(newId,linkedTaskIds);
                  }
                }
                if(ctx2.mounted) Navigator.pop(ctx2);
                _load();
              },
              child: Text(isEdit?'Speichern':'Meilenstein erstellen'),
            )),
          ])),
        ]),
      )),
    );
  }
  Widget _typeBtn(StateSetter ss, String v, String l, String cur, void Function(String) onSet) {
    final sel=cur==v; final col=_typeColor(v);
    return Expanded(child:GestureDetector(onTap:()=>ss(()=>onSet(v)),child:Container(
      padding:const EdgeInsets.symmetric(vertical:10),
      decoration:BoxDecoration(color:sel?col:col.withValues(alpha:0.1),borderRadius:BorderRadius.circular(10),border:Border.all(color:sel?col:col.withValues(alpha:0.3),width:sel?2:1)),
      child:Center(child:Text(l,style:TextStyle(fontSize:11,fontWeight:FontWeight.w600,color:sel?Colors.white:col))),
    )));
  }
  static Color _hexColor(String h){try{return Color(int.parse(h.replaceFirst('#','0xFF')));}catch(_){return const Color(0xFF3B82F6);}}
}

// ── Milestone List Card ────────────────────────────────────────────────────────
class _MilestoneListCard extends StatelessWidget {
  final Map<String,dynamic> m;
  final VoidCallback onToggle, onTap, onEdit, onDelete;
  const _MilestoneListCard({required this.m,required this.onToggle,required this.onTap,required this.onEdit,required this.onDelete});

  @override Widget build(BuildContext ctx) {
    final isCompleted=m['status']=='completed';
    final tc=_typeColor(m['event_type'] as String?);
    final linkedItems=(m['linkedItems'] as List?)?.cast<Map<String,dynamic>>()??[];
    final doneItems=linkedItems.where((li){final s=li['status'] as String?;return s=='done'||s=='resolved';}).length;
    final pct=linkedItems.isEmpty?0:((doneItems/linkedItems.length)*100).round();
    final now=DateTime.now();
    final startDate=m['start_date'] as String?;
    final dt=startDate!=null?DateTime.tryParse(startDate):null;
    String daysText='';
    if(dt!=null&&!isCompleted){final diff=dt.difference(now).inDays;if(diff>0)daysText='in $diff Tagen';else if(diff<0)daysText='${diff.abs()} Tage überfällig';else daysText='Heute';}

    return Container(
      margin:const EdgeInsets.symmetric(horizontal:16,vertical:5),
      decoration:BoxDecoration(color:AppColors.surface,borderRadius:BorderRadius.circular(14),border:Border.all(color:AppColors.border)),
      child:InkWell(borderRadius:BorderRadius.circular(14),onTap:onTap,child:Padding(padding:const EdgeInsets.all(14),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
          // Circle checkbox (web-style)
          GestureDetector(
            onTap: onToggle,
            child: Container(
              width: 22, height: 22,
              margin: const EdgeInsets.only(top: 1, right: 10),
              decoration: BoxDecoration(
                color: isCompleted ? AppColors.success : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(color: isCompleted ? AppColors.success : AppColors.border, width: 2),
              ),
              child: isCompleted ? const Icon(LucideIcons.check, size: 13, color: Colors.white) : null,
            ),
          ),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text(m['title']??'',style:TextStyle(fontSize:15,fontWeight:FontWeight.w600,color:AppColors.text,decoration:isCompleted?TextDecoration.lineThrough:null,decorationColor:AppColors.textSecondary)),
            const SizedBox(height:4),
            Row(children:[
              Container(padding:const EdgeInsets.symmetric(horizontal:6,vertical:2),decoration:BoxDecoration(color:tc.withValues(alpha:0.1),borderRadius:BorderRadius.circular(4)),child:Text(_typeLabel(m['event_type'] as String?),style:TextStyle(fontSize:10,fontWeight:FontWeight.w600,color:tc))),
              if(linkedItems.isNotEmpty)...[const SizedBox(width:6),Container(padding:const EdgeInsets.symmetric(horizontal:6,vertical:2),decoration:BoxDecoration(color:AppColors.border,borderRadius:BorderRadius.circular(4)),child:Text('${linkedItems.length} Verknüpft',style:const TextStyle(fontSize:10,color:AppColors.textSecondary)))],
              const Spacer(),
              if(startDate!=null) Text(_fmt(startDate),style:const TextStyle(fontSize:11,color:AppColors.textTertiary)),
            ]),
          ])),

        ]),
        if(daysText.isNotEmpty)...[const SizedBox(height:6),Text(daysText,style:TextStyle(fontSize:11,color:daysText.contains('überfällig')?AppColors.danger:AppColors.textSecondary))],
        Builder(builder:(_){
          final creator=m['creator'] as Map<String,dynamic>?;
          final fn=(((creator?['first_name'] as String?) ?? '')).trim();
          final ln=(((creator?['last_name'] as String?) ?? '')).trim();
          final full='$fn $ln'.trim();
          final name=full.isNotEmpty?full:(creator?['email'] as String?);
          final createdAt=m['created_at'] as String?;
          if(name==null&&createdAt==null) return const SizedBox.shrink();
          return Padding(padding:const EdgeInsets.only(top:4),child:Row(children:[
            const Icon(LucideIcons.userCheck,size:11,color:AppColors.textTertiary),
            const SizedBox(width:4),
            Expanded(child:Text([if(name!=null&&name.isNotEmpty)name,if(createdAt!=null)_fmt(createdAt)].join(' · '),style:const TextStyle(fontSize:10,color:AppColors.textTertiary),overflow:TextOverflow.ellipsis)),
          ]));
        }),
        if(linkedItems.isNotEmpty)...[
          const SizedBox(height:10),
          Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[
            Text('$doneItems/${linkedItems.length} erledigt',style:const TextStyle(fontSize:11,color:AppColors.textTertiary)),
            Text('$pct%',style:TextStyle(fontSize:11,fontWeight:FontWeight.w600,color:_progressColor(pct))),
          ]),
          const SizedBox(height:4),
          ClipRRect(borderRadius:BorderRadius.circular(4),child:LinearProgressIndicator(value:linkedItems.isEmpty?0:doneItems/linkedItems.length,minHeight:5,backgroundColor:AppColors.border,valueColor:AlwaysStoppedAnimation(_progressColor(pct)))),
        ],
      ]))),
    );
  }
}

// ── Timeline Card ─────────────────────────────────────────────────────────────
class _TimelineCard extends StatelessWidget {
  final Map<String,dynamic> m;
  final bool isLast;
  final VoidCallback onTap;
  const _TimelineCard({required this.m,required this.isLast,required this.onTap});

  @override Widget build(BuildContext ctx) {
    final isCompleted=m['status']=='completed';
    final tc=_typeColor(m['event_type'] as String?);
    final linkedItems=(m['linkedItems'] as List?)?.cast<Map<String,dynamic>>()??[];
    final doneItems=linkedItems.where((li){final s=li['status'] as String?;return s=='done'||s=='resolved';}).length;
    final pct=linkedItems.isEmpty?0:((doneItems/linkedItems.length)*100).round();
    final desc=m['description'] as String?;
    return Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Padding(padding:const EdgeInsets.only(left:16,right:12),child:Column(children:[
        Container(width:20,height:20,decoration:BoxDecoration(color:isCompleted?AppColors.success:tc,shape:BoxShape.circle,border:Border.all(color:Colors.white,width:2)),child:isCompleted?const Icon(LucideIcons.check,size:12,color:Colors.white):null),
        if(!isLast) Container(width:2,height:80,color:AppColors.border),
      ])),
      Expanded(child:GestureDetector(onTap:onTap,child:Container(
        margin:const EdgeInsets.only(bottom:12,right:16),
        padding:const EdgeInsets.all(14),
        decoration:BoxDecoration(color:AppColors.surface,borderRadius:BorderRadius.circular(12),border:Border.all(color:AppColors.border),boxShadow:[BoxShadow(color:tc.withValues(alpha:0.08),blurRadius:8,offset:const Offset(0,2))]),
        child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Row(children:[
            Container(width:5,height:40,decoration:BoxDecoration(color:tc,borderRadius:BorderRadius.circular(2)),margin:const EdgeInsets.only(right:10)),
            Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text(m['title']??'',style:TextStyle(fontSize:14,fontWeight:FontWeight.w600,color:AppColors.text,decoration:isCompleted?TextDecoration.lineThrough:null)),
              const SizedBox(height:2),
              Row(children:[
                Text(_fmt(m['start_date'] as String?),style:const TextStyle(fontSize:11,color:AppColors.textTertiary)),
                if(m['end_date']!=null)...[const Text(' – ',style:TextStyle(fontSize:11,color:AppColors.textTertiary)),Text(_fmt(m['end_date'] as String?),style:const TextStyle(fontSize:11,color:AppColors.textTertiary))],
              ]),
            ])),
            Container(padding:const EdgeInsets.symmetric(horizontal:6,vertical:2),decoration:BoxDecoration(color:tc.withValues(alpha:0.1),borderRadius:BorderRadius.circular(4)),child:Text(_typeLabel(m['event_type'] as String?),style:TextStyle(fontSize:10,fontWeight:FontWeight.w600,color:tc))),
          ]),
          if(desc!=null&&desc.isNotEmpty)...[const SizedBox(height:8),Text(desc,style:const TextStyle(fontSize:13,color:AppColors.textSecondary),maxLines:2,overflow:TextOverflow.ellipsis)],
          Builder(builder:(_){
            final creator=m['creator'] as Map<String,dynamic>?;
            final fn=(((creator?['first_name'] as String?) ?? '')).trim();
            final ln=(((creator?['last_name'] as String?) ?? '')).trim();
            final full='$fn $ln'.trim();
            final name=full.isNotEmpty?full:(creator?['email'] as String?);
            final createdAt=m['created_at'] as String?;
            if(name==null&&createdAt==null) return const SizedBox.shrink();
            return Padding(padding:const EdgeInsets.only(top:6),child:Row(children:[
              const Icon(LucideIcons.userCheck,size:11,color:AppColors.textTertiary),
              const SizedBox(width:4),
              Expanded(child:Text([if(name!=null&&name.isNotEmpty)name,if(createdAt!=null)_fmt(createdAt)].join(' · '),style:const TextStyle(fontSize:10,color:AppColors.textTertiary),overflow:TextOverflow.ellipsis)),
            ]));
          }),
          if(linkedItems.isNotEmpty)...[
            const SizedBox(height:10),
            Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[Text('${linkedItems.length} verknüpfte Elemente',style:const TextStyle(fontSize:11,color:AppColors.textTertiary)),Text('$pct%',style:TextStyle(fontSize:11,fontWeight:FontWeight.w600,color:_progressColor(pct)))]),
            const SizedBox(height:4),
            ClipRRect(borderRadius:BorderRadius.circular(3),child:LinearProgressIndicator(value:linkedItems.isEmpty?0:doneItems/linkedItems.length,minHeight:4,backgroundColor:AppColors.border,valueColor:AlwaysStoppedAnimation(_progressColor(pct)))),
          ],
        ]),
      ))),
    ]);
  }
}
