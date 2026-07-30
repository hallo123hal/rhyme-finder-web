'use client';

import { useEffect, useState } from 'react';
import type { DaoCandidate, Mode } from '@/lib/rhymeEngine';

const MODES: { value: Mode; label: string }[] = [
  { value: 'don', label: 'Vần đơn' },
  { value: 'doi', label: 'Vần đôi' },
  { value: 'ba', label: 'Vần 3' },
  { value: 'bon', label: 'Vần 4' },
  { value: 'dao', label: 'Vần đảo' },
];

type Results = { mode: 'dao'; items: DaoCandidate[] } | { mode: 'plain'; items: string[] };

interface SearchState {
  loading: boolean;
  error: string | null;
  total: number;
  results: Results;
}

const EMPTY_RESULTS: Results = { mode: 'plain', items: [] };
const INITIAL_STATE: SearchState = { loading: false, error: null, total: 0, results: EMPTY_RESULTS };

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
    const requestedMode = mode;
    let ignore = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?word=${encodeURIComponent(trimmed)}&mode=${requestedMode}`
        );
        const data = await res.json();
        if (ignore) return;
        if (!res.ok) {
          setState({ loading: false, error: data.error, total: 0, results: EMPTY_RESULTS });
          return;
        }
        setState({
          loading: false,
          error: null,
          total: data.total,
          results:
            requestedMode === 'dao'
              ? { mode: 'dao', items: data.results as DaoCandidate[] }
              : { mode: 'plain', items: data.results as string[] },
        });
      } catch {
        if (ignore) return;
        setState({
          loading: false,
          error: 'Có lỗi xảy ra, thử lại sau.',
          total: 0,
          results: EMPTY_RESULTS,
        });
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [word, mode]);

  const isDao = mode === 'dao';
  const results = state.results;
  const daoResults = results.mode === 'dao' && isDao ? results.items : [];
  const plainResults = results.mode === 'plain' && !isDao ? results.items : [];

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

      {plainResults.length > 0 && (
        <ul className="results">
          {plainResults.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {daoResults.length > 0 && (
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
