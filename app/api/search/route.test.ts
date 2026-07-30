import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

function request(word: string, mode: string): NextRequest {
  const url = `http://localhost/api/search?word=${encodeURIComponent(word)}&mode=${mode}`;
  return new NextRequest(url);
}

describe('GET /api/search', () => {
  it('returns rhyme results for a plain mode', async () => {
    const res = await GET(request('yêu', 'don'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe('don');
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('returns dao candidates shaped as {text, attested, keepsOriginalOnsets}', async () => {
    // Exact nói-lái correctness (e.g. "phải chăng" -> "chẳng phai") is already
    // verified against controlled fixtures in lib/rhymeEngine.test.ts; this
    // route-level test only checks wiring and response shape against the
    // real bundled dictionary.
    const res = await GET(request('phải chăng', 'dao'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe('dao');
    if (body.results.length > 0) {
      expect(body.results[0]).toEqual(
        expect.objectContaining({
          text: expect.any(String),
          attested: expect.any(Boolean),
          keepsOriginalOnsets: expect.any(Boolean),
        })
      );
    }
  });

  it('returns 400 with an error message for empty input', async () => {
    const res = await GET(request('', 'don'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('returns 400 when the mode requires more syllables than given', async () => {
    const res = await GET(request('yêu', 'doi'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('strips punctuation and digits from the input before searching', async () => {
    const res = await GET(request('yêu!!123', 'don'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.query).toBe('yêu');
  });
});
