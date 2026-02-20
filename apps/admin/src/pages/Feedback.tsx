import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput as RNTextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  MessageSquare, Star, Download, Filter, X, Search,
  User, Clock, Tag, FileJson, FileSpreadsheet,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeedbackEntry {
  id: string;
  user_id: string | null;
  rating: number | null;
  category: string;
  email: string | null;
  message: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  general: 'Allgemeines', allgemein: 'Allgemeines',
  bug: 'Fehlerbericht', feature: 'Funktionswunsch',
  ui: 'Benutzeroberfläche', design: 'Design',
  performance: 'Performance', other: 'Sonstiges',
};

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  general:     { color: '#3b82f6', bg: '#3b82f620' },
  allgemein:   { color: '#3b82f6', bg: '#3b82f620' },
  bug:         { color: '#ef4444', bg: '#ef444420' },
  feature:     { color: '#8b5cf6', bg: '#8b5cf620' },
  ui:          { color: '#f97316', bg: '#f9731620' },
  design:      { color: '#f97316', bg: '#f9731620' },
  performance: { color: '#f59e0b', bg: '#f59e0b20' },
  other:       { color: '#64748b', bg: '#64748b20' },
};

function catColor(cat: string) { return CATEGORY_COLORS[cat] ?? { color: '#64748b', bg: '#64748b20' }; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <Text style={{ fontSize: 12, color: '#94a3b8' }}>Keine Bewertung</Text>;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => <Star key={i} size={14} color={i <= rating ? '#fbbf24' : '#e2e8f0'} fill={i <= rating ? '#fbbf24' : 'none'} />)}
    </View>
  );
}

function CatBadge({ category }: { category: string }) {
  const { color, bg } = catColor(category);
  return (
    <View style={[b.wrap, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[b.txt, { color }]}>{CATEGORY_LABELS[category] ?? category}</Text>
    </View>
  );
}
const b = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  txt:  { fontSize: 11, fontWeight: '600' as any },
});

// ─── Download ─────────────────────────────────────────────────────────────────
function dlJSON(data: FeedbackEntry[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `feedback_${new Date().toISOString().split('T')[0]}.json` });
  a.click(); URL.revokeObjectURL(url);
}

function dlExcel(data: FeedbackEntry[]) {
  const hdr = ['ID','Datum','Bewertung','Kategorie','E-Mail','Nachricht'];
  const rows = data.map(f => [f.id, formatDate(f.created_at), f.rating ?? '', CATEGORY_LABELS[f.category] ?? f.category, f.email ?? '', `"${(f.message ?? '').replace(/"/g,'""')}"`]);
  const csv = '\uFEFF' + [hdr.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `feedback_${new Date().toISOString().split('T')[0]}.csv` });
  a.click(); URL.revokeObjectURL(url);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const CATS = ['general','allgemein','bug','feature','ui','design','performance','other'];

export default function FeedbackAdmin() {
  const [entries,  setEntries]  = useState<FeedbackEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [search,   setSearch]   = useState('');
  const [showF,    setShowF]    = useState(false);
  const [showDl,   setShowDl]   = useState(false);

  // view filters
  const [fCats,   setFCats]   = useState<string[]>([]);
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');
  const [fRating, setFRating] = useState<number | null>(null);

  // download filters
  const [dCats,   setDCats]   = useState<string[]>([]);
  const [dFrom,   setDFrom]   = useState('');
  const [dTo,     setDTo]     = useState('');
  const [dRating, setDRating] = useState<number | null>(null);

  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({msg, type}); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (e:any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyFilter = (list: FeedbackEntry[], cats: string[], from: string, to: string, rating: number|null) =>
    list.filter(f => {
      if (cats.length > 0 && !cats.includes(f.category)) return false;
      if (from && new Date(f.created_at) < new Date(from)) return false;
      if (to) { const e = new Date(to); e.setHours(23,59,59); if (new Date(f.created_at) > e) return false; }
      if (rating != null && f.rating !== rating) return false;
      return true;
    });

  const filtered = applyFilter(entries, fCats, fFrom, fTo, fRating).filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (f.message ?? '').toLowerCase().includes(q) || (f.email ?? '').toLowerCase().includes(q);
  });

  const avg = (() => {
    const r = entries.filter(e => e.rating != null);
    return r.length ? (r.reduce((s,e) => s + e.rating!, 0) / r.length).toFixed(1) : null;
  })();

  const catCounts = CATS.reduce<Record<string,number>>((a,c) => { a[c] = entries.filter(e=>e.category===c).length; return a; }, {});

  const handleDl = (fmt: 'json'|'excel') => {
    const data = applyFilter(entries, dCats, dFrom, dTo, dRating);
    if (fmt === 'json') dlJSON(data); else dlExcel(data);
    showToast(`${data.length} Einträge exportiert`);
    setShowDl(false);
  };

  const hasFilter = fCats.length > 0 || fFrom || fTo || fRating != null;

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={s.root}>
      {toast && <View style={[s.toast, toast.type==='error' && s.toastErr]}><Text style={s.toastTxt}>{toast.msg}</Text></View>}

      <View style={s.body}>
        {/* LEFT */}
        <View style={s.left}>
          {/* Stats */}
          <View style={s.stats}>
            {[
              { v: String(entries.length), l: 'Gesamt',   c: '#0f172a' },
              { v: avg ?? '–',            l: '⌀ Bewert.', c: '#fbbf24' },
              { v: String(catCounts.bug||0), l: 'Bugs',   c: '#ef4444' },
              { v: String(catCounts.feature||0), l: 'Features', c: '#8b5cf6' },
            ].map(({ v, l, c }) => (
              <View key={l} style={s.statCard}>
                <Text style={[s.statV, { color: c }]}>{v}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Toolbar */}
          <View style={s.toolbar}>
            <View style={s.srch}>
              <Search size={15} color="#94a3b8" />
              <RNTextInput style={s.srchIn} value={search} onChangeText={setSearch} placeholder="Suchen…" placeholderTextColor="#94a3b8" />
            </View>
            <TouchableOpacity style={[s.tbBtn, showF && s.tbBtnOn]} onPress={() => setShowF(v=>!v)} activeOpacity={0.7}>
              <Filter size={15} color={showF ? '#2563eb' : '#64748b'} />
              {hasFilter && <View style={s.dot} />}
            </TouchableOpacity>
            <TouchableOpacity style={[s.tbBtn, showDl && s.tbBtnOn]} onPress={() => setShowDl(v=>!v)} activeOpacity={0.7}>
              <Download size={15} color={showDl ? '#2563eb' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Filter panel */}
          {showF && (
            <View style={s.panel}>
              <Text style={s.panelTitle}>Filter</Text>
              <Text style={s.panelLbl}>KATEGORIEN</Text>
              <View style={s.chips}>
                {CATS.filter(c => catCounts[c] > 0).map(c => {
                  const on = fCats.includes(c);
                  const { color, bg } = catColor(c);
                  return (
                    <TouchableOpacity key={c} style={[s.chip, on && { backgroundColor: bg, borderColor: color }]}
                      onPress={() => setFCats(p => on ? p.filter(x=>x!==c) : [...p,c])} activeOpacity={0.7}>
                      <Text style={[s.chipTxt, on && { color }]}>{CATEGORY_LABELS[c]??c} ({catCounts[c]})</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[s.panelLbl, { marginTop: 10 }]}>BEWERTUNG</Text>
              <View style={s.chips}>
                {([null,1,2,3,4,5] as (number|null)[]).map(r => (
                  <TouchableOpacity key={String(r)} style={[s.chip, fRating===r && { backgroundColor:'#fef9c3', borderColor:'#fbbf24' }]}
                    onPress={() => setFRating(r)} activeOpacity={0.7}>
                    <Text style={[s.chipTxt, fRating===r && { color:'#d97706' }]}>{r==null?'Alle':`${r} ★`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.panelLbl, { marginTop: 10 }]}>ZEITRAUM</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={s.dateBox}><Text style={s.dateLbl}>Von</Text>
                  <input type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)}
                    style={{ border:'none',outline:'none',fontSize:13,color:'#0f172a',background:'transparent',width:'100%' }} />
                </View>
                <View style={s.dateBox}><Text style={s.dateLbl}>Bis</Text>
                  <input type="date" value={fTo} onChange={e=>setFTo(e.target.value)}
                    style={{ border:'none',outline:'none',fontSize:13,color:'#0f172a',background:'transparent',width:'100%' }} />
                </View>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                <TouchableOpacity style={s.clearBtn} onPress={() => { setFCats([]); setFFrom(''); setFTo(''); setFRating(null); }} activeOpacity={0.7}>
                  <X size={12} color="#64748b" /><Text style={s.clearTxt}>Zurücksetzen</Text>
                </TouchableOpacity>
                <Text style={s.cnt}>{filtered.length} / {entries.length}</Text>
              </View>
            </View>
          )}

          {/* Download panel */}
          {showDl && (
            <View style={s.panel}>
              <Text style={s.panelTitle}>Download-Filter</Text>
              <Text style={s.panelLbl}>KATEGORIEN</Text>
              <View style={s.chips}>
                <TouchableOpacity style={[s.chip, dCats.length===0 && { backgroundColor:'#eff6ff', borderColor:'#2563eb' }]}
                  onPress={() => setDCats([])} activeOpacity={0.7}>
                  <Text style={[s.chipTxt, dCats.length===0 && { color:'#2563eb' }]}>Alle</Text>
                </TouchableOpacity>
                {CATS.filter(c=>catCounts[c]>0).map(c => {
                  const on = dCats.includes(c); const { color, bg } = catColor(c);
                  return (
                    <TouchableOpacity key={c} style={[s.chip, on && { backgroundColor:bg, borderColor:color }]}
                      onPress={() => setDCats(p => on ? p.filter(x=>x!==c):[...p,c])} activeOpacity={0.7}>
                      <Text style={[s.chipTxt, on && { color }]}>{CATEGORY_LABELS[c]??c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[s.panelLbl,{marginTop:10}]}>BEWERTUNG</Text>
              <View style={s.chips}>
                {([null,1,2,3,4,5] as (number|null)[]).map(r => (
                  <TouchableOpacity key={String(r)} style={[s.chip, dRating===r && { backgroundColor:'#fef9c3', borderColor:'#fbbf24' }]}
                    onPress={() => setDRating(r)} activeOpacity={0.7}>
                    <Text style={[s.chipTxt, dRating===r && { color:'#d97706' }]}>{r==null?'Alle':`${r} ★`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.panelLbl,{marginTop:10}]}>ZEITRAUM</Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                <View style={s.dateBox}><Text style={s.dateLbl}>Von</Text>
                  <input type="date" value={dFrom} onChange={e=>setDFrom(e.target.value)}
                    style={{ border:'none',outline:'none',fontSize:13,color:'#0f172a',background:'transparent',width:'100%' }} />
                </View>
                <View style={s.dateBox}><Text style={s.dateLbl}>Bis</Text>
                  <input type="date" value={dTo} onChange={e=>setDTo(e.target.value)}
                    style={{ border:'none',outline:'none',fontSize:13,color:'#0f172a',background:'transparent',width:'100%' }} />
                </View>
              </View>
              <Text style={[s.cnt,{marginTop:8}]}>{applyFilter(entries, dCats, dFrom, dTo, dRating).length} Einträge werden exportiert</Text>
              <View style={{ flexDirection:'row', gap:10, marginTop:12 }}>
                <TouchableOpacity style={[s.dlBtn,{backgroundColor:'#1d4ed8'}]} onPress={() => handleDl('json')} activeOpacity={0.8}>
                  <FileJson size={16} color="#fff" /><Text style={s.dlTxt}>JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.dlBtn,{backgroundColor:'#16a34a'}]} onPress={() => handleDl('excel')} activeOpacity={0.8}>
                  <FileSpreadsheet size={16} color="#fff" /><Text style={s.dlTxt}>Excel / CSV</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* List */}
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 && (
              <View style={s.empty}><MessageSquare size={36} color="#cbd5e1" /><Text style={s.emptyTxt}>Kein Feedback gefunden</Text></View>
            )}
            {filtered.map(f => {
              const isSel = selected?.id === f.id;
              return (
                <TouchableOpacity key={f.id} style={[s.card, isSel && s.cardSel]} onPress={() => setSelected(f)} activeOpacity={0.7}>
                  <View style={s.cardTop}>
                    <View style={s.avatar}><User size={15} color="#2563eb" /></View>
                    <View style={{flex:1}}>
                      <Text style={s.cardEmail} numberOfLines={1}>{f.email ?? 'Kein E-Mail'}</Text>
                      <Text style={s.cardDate}>{formatDate(f.created_at)}</Text>
                    </View>
                    <CatBadge category={f.category} />
                  </View>
                  <Stars rating={f.rating} />
                  <Text style={s.cardMsg} numberOfLines={2}>{f.message}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{height:60}} />
          </ScrollView>
        </View>

        {/* RIGHT */}
        <View style={s.right}>
          {!selected ? (
            <View style={s.noSel}>
              <MessageSquare size={48} color="#cbd5e1" />
              <Text style={s.noSelTxt}>Feedback auswählen</Text>
              <Text style={s.noSelSub}>Klicken Sie auf einen Eintrag, um die Details anzuzeigen</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.dHdr}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap' as any,flex:1}}>
                  <CatBadge category={selected.category} />
                  <Text style={s.dDate}>{formatDate(selected.created_at)}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={s.closeBtn} activeOpacity={0.7}>
                  <X size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={s.dSection}>
                <Text style={s.dLabel}>BEWERTUNG</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <Stars rating={selected.rating} />
                  {selected.rating != null && <Text style={s.dRating}>{selected.rating}/5</Text>}
                </View>
              </View>
              {selected.email && (
                <View style={s.dSection}>
                  <Text style={s.dLabel}>E-MAIL</Text>
                  <Text style={s.dVal}>{selected.email}</Text>
                </View>
              )}
              <View style={s.dSection}>
                <Text style={s.dLabel}>NACHRICHT</Text>
                <View style={s.msgBox}><Text style={s.msgTxt}>{selected.message}</Text></View>
              </View>
              <View style={{flexDirection:'row',gap:20,flexWrap:'wrap' as any}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Clock size={13} color="#94a3b8" />
                  <Text style={s.metaTxt}>{formatDate(selected.created_at)}</Text>
                </View>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Tag size={13} color="#94a3b8" />
                  <Text style={s.metaTxt}>{CATEGORY_LABELS[selected.category] ?? selected.category}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex:1, backgroundColor:'#f8fafc', position:'relative' as any },
  centered:{ flex:1, alignItems:'center', justifyContent:'center' },
  toast:   { position:'absolute' as any, top:16, right:16, backgroundColor:'#10b981', borderRadius:10, paddingHorizontal:16, paddingVertical:10, zIndex:9999 },
  toastErr:{ backgroundColor:'#ef4444' },
  toastTxt:{ color:'#fff', fontWeight:'600', fontSize:14 },
  body:    { flex:1, flexDirection:'row' },

  left:    { width:420, borderRightWidth:1, borderRightColor:'#e2e8f0', display:'flex' as any, flexDirection:'column' },
  stats:   { flexDirection:'row', gap:8, padding:16, paddingBottom:10 },
  statCard:{ flex:1, backgroundColor:'#fff', borderRadius:10, padding:10, alignItems:'center', borderWidth:1, borderColor:'#e2e8f0' },
  statV:   { fontSize:20, fontWeight:'800' as any },
  statL:   { fontSize:10, color:'#94a3b8', marginTop:2 },

  toolbar: { flexDirection:'row', gap:8, paddingHorizontal:16, paddingBottom:10, alignItems:'center' },
  srch:    { flex:1, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'#e2e8f0', paddingHorizontal:12, paddingVertical:8 },
  srchIn:  { flex:1, fontSize:14, color:'#0f172a' },
  tbBtn:   { width:38, height:38, borderRadius:10, backgroundColor:'#fff', borderWidth:1, borderColor:'#e2e8f0', alignItems:'center', justifyContent:'center' },
  tbBtnOn: { backgroundColor:'#eff6ff', borderColor:'#93c5fd' },
  dot:     { position:'absolute' as any, top:6, right:6, width:7, height:7, borderRadius:4, backgroundColor:'#ef4444' },

  panel:     { backgroundColor:'#fff', borderWidth:1, borderColor:'#e2e8f0', borderRadius:12, margin:16, marginTop:0, padding:14 },
  panelTitle:{ fontSize:13, fontWeight:'700' as any, color:'#0f172a', marginBottom:12 },
  panelLbl:  { fontSize:11, fontWeight:'700' as any, color:'#94a3b8', marginBottom:6, letterSpacing:0.6 },
  chips:     { flexDirection:'row', flexWrap:'wrap' as any, gap:6 },
  chip:      { paddingHorizontal:10, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'#e2e8f0', backgroundColor:'#f8fafc' },
  chipTxt:   { fontSize:12, fontWeight:'600' as any, color:'#64748b' },
  dateBox:   { flex:1, backgroundColor:'#f8fafc', borderRadius:8, borderWidth:1, borderColor:'#e2e8f0', padding:10 },
  dateLbl:   { fontSize:10, color:'#94a3b8', marginBottom:2 },
  clearBtn:  { flexDirection:'row', alignItems:'center', gap:6 },
  clearTxt:  { fontSize:12, color:'#64748b' },
  cnt:       { fontSize:12, color:'#94a3b8' },
  dlBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:10, paddingVertical:11 },
  dlTxt:     { fontSize:14, fontWeight:'700' as any, color:'#fff' },

  list:    { flex:1, paddingHorizontal:16 },
  empty:   { alignItems:'center', paddingTop:60, gap:12 },
  emptyTxt:{ color:'#94a3b8', fontSize:15, fontWeight:'600' as any },

  card:    { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:8, borderWidth:1, borderColor:'#e2e8f0', gap:6 },
  cardSel: { borderColor:'#2563eb', backgroundColor:'#eff6ff' },
  cardTop: { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:4 },
  avatar:  { width:34, height:34, borderRadius:17, backgroundColor:'#dbeafe', alignItems:'center', justifyContent:'center', flexShrink:0 },
  cardEmail:{ fontSize:13, fontWeight:'600' as any, color:'#0f172a' },
  cardDate: { fontSize:11, color:'#94a3b8' },
  cardMsg:  { fontSize:13, color:'#475569', lineHeight:18 },

  right:   { flex:1, padding:24 },
  noSel:   { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  noSelTxt:{ fontSize:18, fontWeight:'700' as any, color:'#94a3b8' },
  noSelSub:{ fontSize:14, color:'#cbd5e1', textAlign:'center' as any, maxWidth:280 },

  dHdr:    { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  dDate:   { fontSize:13, color:'#64748b' },
  closeBtn:{ width:36, height:36, borderRadius:10, backgroundColor:'#f1f5f9', alignItems:'center', justifyContent:'center' },
  dSection:{ marginBottom:20 },
  dLabel:  { fontSize:11, fontWeight:'700' as any, color:'#94a3b8', marginBottom:8, letterSpacing:0.8 },
  dVal:    { fontSize:14, color:'#0f172a' },
  dRating: { fontSize:16, fontWeight:'700' as any, color:'#fbbf24' },
  msgBox:  { backgroundColor:'#f8fafc', borderRadius:12, padding:16, borderWidth:1, borderColor:'#e2e8f0' },
  msgTxt:  { fontSize:15, color:'#334155', lineHeight:24 },
  metaTxt: { fontSize:12, color:'#64748b' },
});
