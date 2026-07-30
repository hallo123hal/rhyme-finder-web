import { describe, expect, it } from 'vitest';
import { buildDictionary } from './dictionary';
import { searchRhyme, RhymeSearchError, generateDao } from './rhymeEngine';

const FIXTURE = ['yêu', 'chiều', 'chăng', 'trăng', 'vắng', 'yêu thương', 'kiều dương'];

describe('searchRhyme', () => {
  it('finds vần đơn matches on the last syllable regardless of tone', () => {
    const dict = buildDictionary(FIXTURE);
    const result = searchRhyme(dict, 'yêu', 'don');
    expect(result.results).toContain('chiều');
  });

  it('excludes the input word itself from results', () => {
    const dict = buildDictionary(FIXTURE);
    const result = searchRhyme(dict, 'yêu', 'don');
    expect(result.results).not.toContain('yêu');
  });

  it('ranks same-tone candidates above different-tone-group candidates', () => {
    // chăng/trăng/vắng all rhyme "ăng"; trăng is tone ngang (exact match with
    // the ngang query, +2), vắng is tone sắc (different tone group, +0).
    const dict = buildDictionary(['chăng', 'trăng', 'vắng']);
    const result = searchRhyme(dict, 'chăng', 'don');
    expect(result.results.indexOf('trăng')).toBeLessThan(result.results.indexOf('vắng'));
  });

  it('matches vần đôi on the trailing two syllables regardless of total length', () => {
    const dict = buildDictionary(FIXTURE);
    const result = searchRhyme(dict, 'yêu thương', 'doi');
    expect(result.results).toContain('kiều dương');
  });

  it('throws RhymeSearchError when input has fewer syllables than the mode needs', () => {
    const dict = buildDictionary(FIXTURE);
    expect(() => searchRhyme(dict, 'yêu', 'doi')).toThrow(RhymeSearchError);
  });

  it('reports the total count alongside a capped results list', () => {
    const many = Array.from({ length: 250 }, () => 'chăng');
    const dict = buildDictionary(['măng', ...many]);
    const result = searchRhyme(dict, 'măng', 'don');
    expect(result.total).toBeGreaterThan(200);
    expect(result.results.length).toBe(200);
  });
});

const DAO_FIXTURE = ['phải', 'chăng', 'chẳng', 'phẳng', 'phai', 'di', 'dời', 'rơi', 'gì', 'dơi', 'dì'];

describe('generateDao', () => {
  it('reproduces the "phải chăng" -> "chẳng phai" nói lái pair', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'phải chăng');
    expect(result.results.map((r) => r.text)).toContain('chẳng phai');
  });

  it('reproduces the "di dời" -> "rơi gì" nói lái pair', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'di dời');
    expect(result.results.map((r) => r.text)).toContain('rơi gì');
  });

  it('flags candidates that keep the original onsets', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'di dời');
    const dơiDi = result.results.find((r) => r.text === 'dơi dì');
    expect(dơiDi?.keepsOriginalOnsets).toBe(true);
    const rơiGi = result.results.find((r) => r.text === 'rơi gì');
    expect(rơiGi?.keepsOriginalOnsets).toBe(false);
  });

  it('flags candidates that are also an attested adjacent pair in the dictionary', () => {
    const dict = buildDictionary(['phải chăng', 'chẳng phai', ...DAO_FIXTURE]);
    const result = generateDao(dict, 'phải chăng');
    const chẳngPhai = result.results.find((r) => r.text === 'chẳng phai');
    expect(chẳngPhai?.attested).toBe(true);
  });

  it('sorts attested candidates before non-attested ones', () => {
    // With "phẳng" also matching the ăng|hỏi slot, "phẳng phai" becomes a
    // second valid-but-unattested candidate alongside the attested "chẳng phai".
    const dict = buildDictionary(['phải chăng', 'chẳng phai', ...DAO_FIXTURE]);
    const result = generateDao(dict, 'phải chăng');
    expect(result.results[0].text).toBe('chẳng phai');
  });

  it('keeps a fixed prefix when the input has more than two syllables', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    const result = generateDao(dict, 'xin di dời');
    expect(result.results.some((r) => r.text === 'xin rơi gì')).toBe(true);
  });

  it('throws RhymeSearchError when input has fewer than two syllables', () => {
    const dict = buildDictionary(DAO_FIXTURE);
    expect(() => generateDao(dict, 'di')).toThrow(RhymeSearchError);
  });
});
