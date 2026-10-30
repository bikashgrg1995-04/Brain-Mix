import type { WordEntry } from '../../shared/types';

/**
 * SAMPLE words matra. Spelling (canonical) tapai le final garnus, aliases pachhi thapne.
 * Phase 1 ma answer client ma chha (testing ko lagi). Phase 2 ma server ma jancha.
 */
export const WORDS: WordEntry[] = [
  // Easy (4-5)
  { answer: 'momo', difficulty: 1, category: 'Khana', hint: 'Bhapma pakaeko, achar sanga' },
  { answer: 'pani', difficulty: 1, category: 'Roj ko', hint: 'Tirkha lagda khane' },
  { answer: 'ghar', difficulty: 1, category: 'Roj ko', hint: 'Basne thau' },
  { answer: 'chiya', difficulty: 1, category: 'Khana', hint: 'Bihana ko pey' },
  { answer: 'kitab', difficulty: 1, category: 'Roj ko', hint: 'Padhne kura' },
  { answer: 'nepal', difficulty: 1, category: 'Thau', hint: 'Hamro desh' },
  // Medium (5-6)
  { answer: 'himal', difficulty: 2, category: 'Prakriti', hint: 'Barfa le dhakeko thulo pahad' },
  { answer: 'tihar', difficulty: 2, category: 'Chadparba', hint: 'Batti ra deusi ko parba' },
  { answer: 'lukla', difficulty: 2, category: 'Thau', hint: 'Everest yatra ko pahilo airport' },
  { answer: 'sherpa', difficulty: 2, category: 'Yatra', hint: 'Himal ma bhar bokne guide' },
  { answer: 'mandir', difficulty: 2, category: 'Thau', hint: 'Puja garne thau' },
  { answer: 'thukpa', difficulty: 2, category: 'Khana', hint: 'Pahad ko jhol nudle' },
  // Hard (6-7)
  { answer: 'nanglo', difficulty: 3, category: 'Ghar', hint: 'Roti banauna, bans ko thaal' },
  { answer: 'dashain', difficulty: 3, category: 'Chadparba', hint: 'Tika ra jamara' },
  { answer: 'tarkari', difficulty: 3, category: 'Khana', hint: 'Bhat sanga khane' },
  { answer: 'dalbhat', difficulty: 3, category: 'Khana', hint: 'Nepali ko roj ko khana' },
  { answer: 'namaste', difficulty: 3, category: 'Roj ko', hint: 'Dui hat jodera bhaneko' },
  // Expert (6-7)
  { answer: 'gundruk', difficulty: 4, category: 'Khana', hint: 'Fermented sag' },
  { answer: 'khukuri', difficulty: 4, category: 'Prakriti', hint: 'Gorkha ko hathiyar' },
  { answer: 'yatri', difficulty: 4, category: 'Yatra', hint: 'Trek garne manche' },
];

/**
 * Phase 1: sahi length ko jun sukai a-z shabda accept (dictionary chaina).
 * Phase 2: valid_guesses list (length bucket 4/5/6/7) ra server check ma sarne.
 */
export const ALLOW_ANY_GUESS = true;
