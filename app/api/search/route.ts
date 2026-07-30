import { NextRequest, NextResponse } from 'next/server';
import { getDictionary } from '@/lib/dictionary';
import { searchRhyme, generateDao, RhymeSearchError, PlainMode } from '@/lib/rhymeEngine';

const PLAIN_MODES: PlainMode[] = ['don', 'doi', 'ba', 'bon'];
const ALLOWED_CHARS =
  'a-zđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ';
const STRIP_PATTERN = new RegExp(`[^${ALLOWED_CHARS}\\s]`, 'g');

const dictionary = getDictionary();

function normalizeInput(raw: string): string {
  return (
    raw
      // Some IMEs emit decomposed (NFD) Vietnamese; without recomposing, the
      // allowlist below would delete the combining tone marks outright and
      // silently turn "phải" into "phai".
      .normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(STRIP_PATTERN, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const word = normalizeInput(searchParams.get('word') ?? '');
  const modeParam = searchParams.get('mode') ?? 'don';

  if (!word) {
    return NextResponse.json({ error: 'Vui lòng nhập từ cần tìm.' }, { status: 400 });
  }

  try {
    if (modeParam === 'dao') {
      const { total, results } = generateDao(dictionary, word);
      return NextResponse.json({ mode: modeParam, query: word, total, results });
    }
    if ((PLAIN_MODES as string[]).includes(modeParam)) {
      const { total, results } = searchRhyme(dictionary, word, modeParam as PlainMode);
      return NextResponse.json({ mode: modeParam, query: word, total, results });
    }
    return NextResponse.json({ error: 'Chế độ không hợp lệ.' }, { status: 400 });
  } catch (err) {
    if (err instanceof RhymeSearchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
