import { describe, expect, it } from 'vitest';
import { analyzeSyllable, analyzePhrase, TONE_GROUP } from './phonetics';

describe('analyzeSyllable', () => {
  it('splits a simple onset + rhyme + ngang tone', () => {
    expect(analyzeSyllable('ba')).toEqual({ onset: 'b', rhyme: 'a', tone: 'ngang', original: 'ba' });
  });

  it('keeps ă as its own base vowel and extracts the hỏi tone correctly', () => {
    expect(analyzeSyllable('chăng')).toEqual({ onset: 'ch', rhyme: 'ăng', tone: 'ngang', original: 'chăng' });
    expect(analyzeSyllable('phải')).toEqual({ onset: 'ph', rhyme: 'ai', tone: 'hoi', original: 'phải' });
  });

  it('handles the ngh/gh/tr/kh digraph onsets', () => {
    expect(analyzeSyllable('nghiêng')).toEqual({ onset: 'ngh', rhyme: 'iêng', tone: 'ngang', original: 'nghiêng' });
    expect(analyzeSyllable('trường')).toEqual({ onset: 'tr', rhyme: 'ương', tone: 'huyen', original: 'trường' });
  });

  it('handles the "gi" onset elision when the rhyme would otherwise be empty', () => {
    expect(analyzeSyllable('gì')).toEqual({ onset: 'gi', rhyme: 'i', tone: 'huyen', original: 'gì' });
  });

  it('treats a standalone leading "y" as equivalent to "i" when there is no onset', () => {
    expect(analyzeSyllable('yêu')).toEqual({ onset: '', rhyme: 'iêu', tone: 'ngang', original: 'yêu' });
    expect(analyzeSyllable('chiều')).toEqual({ onset: 'ch', rhyme: 'iêu', tone: 'huyen', original: 'chiều' });
  });

  it('preserves distinct vowel letters instead of collapsing them', () => {
    expect(analyzeSyllable('dời')).toEqual({ onset: 'd', rhyme: 'ơi', tone: 'huyen', original: 'dời' });
    expect(analyzeSyllable('rơi')).toEqual({ onset: 'r', rhyme: 'ơi', tone: 'ngang', original: 'rơi' });
    expect(analyzeSyllable('di')).toEqual({ onset: 'd', rhyme: 'i', tone: 'ngang', original: 'di' });
  });

  it('lowercases input before analysis', () => {
    expect(analyzeSyllable('Chăng')).toEqual({ onset: 'ch', rhyme: 'ăng', tone: 'ngang', original: 'chăng' });
  });
});

describe('analyzePhrase', () => {
  it('splits on whitespace and analyzes each syllable', () => {
    expect(analyzePhrase('phải chăng')).toEqual([
      { onset: 'ph', rhyme: 'ai', tone: 'hoi', original: 'phải' },
      { onset: 'ch', rhyme: 'ăng', tone: 'ngang', original: 'chăng' },
    ]);
  });

  it('collapses repeated whitespace', () => {
    expect(analyzePhrase('  di   dời  ')).toEqual([
      { onset: 'd', rhyme: 'i', tone: 'ngang', original: 'di' },
      { onset: 'd', rhyme: 'ơi', tone: 'huyen', original: 'dời' },
    ]);
  });
});

describe('TONE_GROUP', () => {
  it('groups ngang and huyen as bang, the rest as trac', () => {
    expect(TONE_GROUP.ngang).toBe('bang');
    expect(TONE_GROUP.huyen).toBe('bang');
    expect(TONE_GROUP.sac).toBe('trac');
    expect(TONE_GROUP.hoi).toBe('trac');
    expect(TONE_GROUP.nga).toBe('trac');
    expect(TONE_GROUP.nang).toBe('trac');
  });
});
