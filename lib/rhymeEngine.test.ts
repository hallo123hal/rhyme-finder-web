import { describe, expect, it } from 'vitest';
import { buildDictionary } from './dictionary';
import { searchRhyme, RhymeSearchError } from './rhymeEngine';

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
