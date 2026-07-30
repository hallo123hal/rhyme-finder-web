'use client';

import { useEffect, useMemo, useState } from 'react';

type Mode = 'don' | 'doi' | 'ba' | 'bon' | 'dao';

const MODES: { value: Mode; label: string }[] = [
  { value: 'don', label: 'Vần đơn' },
  { value: 'doi', label: 'Vần đôi' },
  { value: 'ba', label: 'Vần 3' },
  { value: 'bon', label: 'Vần 4' },
  { value: 'dao', label: 'Vần đảo' },
];

interface DaoCandidate {
  text: string;
  attested: boolean;
  keepsOriginalOnsets: boolean;
}

interface SearchState {
  loading: boolean;
  error: string | null;
  total: number;
  results: string[] | DaoCandidate[];
}

const INITIAL_STATE: SearchState = { loading: false, error: null, total: 0, results: [] };

export default function Home() {
  const [word, setWord] = useState('');
  const [mode, setMode] = useState<Mode>('don');
  const [state, setState] = useState<SearchState>(INITIAL_STATE);

  useEffect(() => {
    const trimmed = word.trim();
    if (!trimmed) {
      setState(INITIAL_STATE);
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    let ignore = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?word=${encodeURIComponent(trimmed)}&mode=${mode}`);
        const data = await res.json();
        if (ignore) return;
        if (!res.ok) {
          setState({ loading: false, error: data.error, total: 0, results: [] });
          return;
        }
        setState({ loading: false, error: null, total: data.total, results: data.results });
      } catch {
        if (ignore) return;
        setState({ loading: false, error: 'Có lỗi xảy ra, thử lại sau.', total: 0, results: [] });
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [word, mode]);

  const isDao = mode === 'dao';
  const daoResults = useMemo(() => (isDao ? (state.results as DaoCandidate[]) : []), [isDao, state.results]);
  const plainResults = useMemo(() => (!isDao ? (state.results as string[]) : []), [isDao, state.results]);

  return (
    <main className="page">
      <h1>Tìm Vần</h1>
      <input
        className="search-input"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Nhập từ hoặc cụm từ..."
      />
      <div className="tabs">
        {MODES.map((m) => (
          <button
            key={m.value}
            className={m.value === mode ? 'tab tab-active' : 'tab'}
            onClick={() => setMode(m.value)}
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>

      {state.loading && <p className="status">Đang tìm...</p>}
      {state.error && <p className="status status-error">{state.error}</p>}
      {!state.loading && !state.error && word.trim() && state.total === 0 && (
        <p className="status">Không tìm thấy.</p>
      )}

      {!isDao && plainResults.length > 0 && (
        <ul className="results">
          {plainResults.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {isDao && daoResults.length > 0 && (
        <ul className="results">
          {daoResults.map((r) => (
            <li key={r.text}>
              {r.text}
              {r.attested && <span className="badge badge-attested">cụm có sẵn</span>}
              {r.keepsOriginalOnsets && <span className="badge">giữ phụ âm gốc</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
