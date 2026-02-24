import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, X, Folder, CheckSquare, BookOpen, AlertCircle, Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'project' | 'task' | 'defect' | 'diary';
  title: string;
  subtitle?: string;
  projectId?: string;
  url: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const TYPE_META: Record<SearchResult['type'], { icon: React.ReactNode; color: string; label: string }> = {
  project: { icon: <Folder size={14} />, color: '#3B82F6', label: 'Projekt' },
  task:    { icon: <CheckSquare size={14} />, color: '#10B981', label: 'Aufgabe' },
  defect:  { icon: <AlertCircle size={14} />, color: '#EF4444', label: 'Mangel' },
  diary:   { icon: <BookOpen size={14} />, color: '#F59E0B', label: 'Bautagebuch' },
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 280);

  // ── Open on ⌘+K / Ctrl+K or ⌘+F ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Close on click outside ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Reset active index when results change ──
  useEffect(() => { setActiveIdx(0); }, [results]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const pattern = `%${q}%`;

      const [projectsRes, tasksRes, diaryRes] = await Promise.allSettled([
        supabase
          .from('projects')
          .select('id, name, address, status')
          .ilike('name', pattern)
          .limit(5),
        supabase
          .from('tasks')
          .select('id, title, description, status, task_type, project_id')
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .limit(8),
        supabase
          .from('diary_entries')
          .select('id, work_performed, entry_date, project_id')
          .ilike('work_performed', pattern)
          .limit(5),
      ]);

      const combined: SearchResult[] = [];

      if (projectsRes.status === 'fulfilled' && projectsRes.value.data) {
        projectsRes.value.data.forEach((p: any) => {
          combined.push({
            id: p.id,
            type: 'project',
            title: p.name,
            subtitle: p.address || (p.status ? `Status: ${p.status}` : undefined),
            url: `/project/${p.id}`,
          });
        });
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data) {
        tasksRes.value.data.forEach((t: any) => {
          const isDefect = t.task_type === 'defect';
          combined.push({
            id: t.id,
            type: isDefect ? 'defect' : 'task',
            title: t.title,
            subtitle: t.status,
            projectId: t.project_id,
            url: `/project/${t.project_id}/${isDefect ? 'defects' : 'tasks'}`,
          });
        });
      }

      if (diaryRes.status === 'fulfilled' && diaryRes.value.data) {
        diaryRes.value.data.forEach((d: any) => {
          const date = d.entry_date
            ? new Date(d.entry_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
          combined.push({
            id: d.id,
            type: 'diary',
            title: d.work_performed?.slice(0, 60) + (d.work_performed?.length > 60 ? '…' : ''),
            subtitle: date,
            projectId: d.project_id,
            url: `/project/${d.project_id}/diary`,
          });
        });
      }

      setResults(combined);
    } catch (err) {
      console.error('GlobalSearch error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[activeIdx]) {
      handleSelect(results[activeIdx]);
    }
  };

  const highlightMatch = (text: string, q: string): React.ReactNode => {
    if (!q || q.length < 2) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 2, padding: '0 1px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const showDropdown = open && (loading || query.trim().length >= 2);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Trigger bar ── */}
      <div
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: open ? '#fff' : '#F8FAFC',
          paddingLeft: 14, paddingRight: 10,
          height: 42, borderRadius: 10,
          border: `1px solid ${open ? '#3B82F6' : '#E2E8F0'}`,
          width: 280,
          cursor: 'text',
          transition: 'border-color 0.15s, background 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
        }}
      >
        <Search size={16} color="#94a3b8" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Suchen… (⌘K)"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent',
            fontSize: 14, color: '#334155',
          }}
        />
        {query ? (
          <button
            onClick={e => { e.stopPropagation(); setQuery(''); setResults([]); inputRef.current?.focus(); }}
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', color: '#94a3b8' }}
          >
            <X size={14} />
          </button>
        ) : (
          <div style={{
            backgroundColor: '#fff', paddingLeft: 7, paddingRight: 7,
            paddingTop: 2, paddingBottom: 2,
            borderRadius: 6, border: '1px solid #E2E8F0',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>⌘K</span>
          </div>
        )}
      </div>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          width: 380, maxHeight: 420, overflowY: 'auto',
          background: '#fff', borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          zIndex: 9999,
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', gap: 8, color: '#94a3b8', fontSize: 14 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Suche läuft…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
              Keine Ergebnisse für „{query.trim()}"
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
              {results.map((result, idx) => {
                const meta = TYPE_META[result.type];
                const isActive = idx === activeIdx;
                return (
                  <li
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 16px',
                      cursor: 'pointer',
                      background: isActive ? '#F1F5F9' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: `${meta.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: meta.color,
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: '#0f172a',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {highlightMatch(result.title, debouncedQuery)}
                      </div>
                      {result.subtitle && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: meta.color,
                      background: `${meta.color}14`,
                      paddingLeft: 7, paddingRight: 7, paddingTop: 2, paddingBottom: 2,
                      borderRadius: 5, flexShrink: 0,
                    }}>
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer hint */}
          {results.length > 0 && (
            <div style={{
              borderTop: '1px solid #F1F5F9',
              padding: '8px 16px',
              display: 'flex', gap: 12, justifyContent: 'flex-end',
            }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>↑↓ navigieren</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>↵ öffnen</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Esc schließen</span>
            </div>
          )}
        </div>
      )}

      {/* Spinner keyframe injection */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
