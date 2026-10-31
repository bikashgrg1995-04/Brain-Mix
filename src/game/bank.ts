import type { Difficulty } from '../../shared/types';

/**
 * SAMPLE sawal bank (admin le level ma quest set nagareko bela random aaune). Tapai le thapne/thik garne.
 * Phase 2 ma server/Supabase ma jancha.
 */
export interface QuizItem { difficulty: Difficulty; category: string; question: string; options: [string, string, string, string]; correct: 0 | 1 | 2 | 3 }
export interface PhotoItem { difficulty: Difficulty; emoji: string; answer: string; hint: string }

export const QUIZ_BANK: QuizItem[] = [
  // Easy
  { difficulty: 1, category: 'Nepal', question: 'Nepal ko rajdhani kun ho?', options: ['Kathmandu', 'Pokhara', 'Biratnagar', 'Janakpur'], correct: 0 },
  { difficulty: 1, category: 'Nepal', question: 'Nepal ko rastriya pashu kun ho?', options: ['Gai', 'Bagh', 'Hatti', 'Kukur'], correct: 0 },
  { difficulty: 1, category: 'Prakriti', question: 'Nepal ko rastriya phool kun ho?', options: ['Gulaf', 'Gurans', 'Kamal', 'Sayapatri'], correct: 1 },
  { difficulty: 1, category: 'Himal', question: 'Everest lai Nepali ma ke bhanchhan?', options: ['Kanchenjunga', 'Makalu', 'Sagarmatha', 'Dhaulagiri'], correct: 2 },
  { difficulty: 1, category: 'Nepal', question: 'Nepal ma kati ota pradesh chhan?', options: ['5', '6', '9', '7'], correct: 3 },
  // Medium
  { difficulty: 2, category: 'Himal', question: 'Sagarmatha ko unchai lagbhag kati ho?', options: ['6,849 m', '7,849 m', '8,849 m', '9,849 m'], correct: 2 },
  { difficulty: 2, category: 'Tal', question: 'Nepal ko sabai bhanda thulo tal kun ho?', options: ['Rara', 'Phewa', 'Begnas', 'Tilicho'], correct: 0 },
  { difficulty: 2, category: 'Itihas', question: 'Lumbini ma kasko janma bhayeko thiyo?', options: ['Ram', 'Krishna', 'Gautam Buddha', 'Shankaracharya'], correct: 2 },
  { difficulty: 2, category: 'Thau', question: 'Pokhara ma kun tal sabai bhanda prasiddha chha?', options: ['Gosaikunda', 'Phewa', 'Rara', 'Phoksundo'], correct: 1 },
  { difficulty: 2, category: 'Nepal', question: 'Nepal ko mudra ko naam ke ho?', options: ['Taka', 'Yen', 'Dinar', 'Rupaiya'], correct: 3 },
  // Hard
  { difficulty: 3, category: 'Nadi', question: 'Nepal ko sabai bhanda lamo nadi kun ho?', options: ['Koshi', 'Karnali', 'Gandaki', 'Bagmati'], correct: 1 },
  { difficulty: 3, category: 'Itihas', question: 'Nepal le kun saal ma ganatantra ghoshana gareko ho?', options: ['2006', '1990', '2008', '2015'], correct: 2 },
  { difficulty: 3, category: 'Thau', question: 'Janakpur kun pradesh ma pardchha?', options: ['Madhesh', 'Koshi', 'Bagmati', 'Lumbini'], correct: 0 },
  { difficulty: 3, category: 'Thau', question: 'Muktinath mandir kun jilla ma chha?', options: ['Manang', 'Mustang', 'Dolpa', 'Solukhumbu'], correct: 1 },
  { difficulty: 3, category: 'Prakriti', question: 'Ek sing bhayeko gaida herna kun rastriya nikunj prasiddha chha?', options: ['Langtang', 'Rara', 'Chitwan', 'Shey Phoksundo'], correct: 2 },
  // Expert
  { difficulty: 4, category: 'Prakriti', question: 'Nepal ko sabai bhanda thulo rastriya nikunj kun ho?', options: ['Chitwan', 'Bardiya', 'Langtang', 'Shey Phoksundo'], correct: 3 },
  { difficulty: 4, category: 'Thau', question: 'Gosaikunda kun jilla ma chha?', options: ['Rasuwa', 'Mustang', 'Dolpa', 'Jumla'], correct: 0 },
  { difficulty: 4, category: 'Tal', question: 'Rara tal kun jilla ma chha?', options: ['Jumla', 'Mugu', 'Humla', 'Dolpa'], correct: 1 },
  { difficulty: 4, category: 'Tal', question: 'Tilicho tal kun jilla ma chha?', options: ['Mustang', 'Gorkha', 'Manang', 'Lamjung'], correct: 2 },
  { difficulty: 4, category: 'Itihas', question: 'Lumbini kun jilla ma pardchha?', options: ['Kapilvastu', 'Chitwan', 'Jhapa', 'Rupandehi'], correct: 3 },
];

export const PHOTO_BANK: PhotoItem[] = [
  { difficulty: 1, emoji: '🥟', answer: 'momo', hint: 'Khana' },
  { difficulty: 1, emoji: '🏠', answer: 'ghar', hint: 'Basne thau' },
  { difficulty: 1, emoji: '📖', answer: 'kitab', hint: 'Padhne kura' },
  { difficulty: 1, emoji: '💧', answer: 'pani', hint: 'Tirkha lagda' },
  { difficulty: 1, emoji: '🍵', answer: 'chiya', hint: 'Bihana ko pey' },
  { difficulty: 2, emoji: '🏔️', answer: 'himal', hint: 'Barfa le dhakeko' },
  { difficulty: 2, emoji: '🛕', answer: 'mandir', hint: 'Puja garne thau' },
  { difficulty: 2, emoji: '🐘', answer: 'hatti', hint: 'Thulo janawar' },
  { difficulty: 2, emoji: '🐟', answer: 'machha', hint: 'Pani ma basne' },
  { difficulty: 2, emoji: '🐎', answer: 'ghoda', hint: 'Dauddine janawar' },
  { difficulty: 3, emoji: '🍚🥘', answer: 'dalbhat', hint: 'Roj ko khana' },
  { difficulty: 3, emoji: '🥕🥦', answer: 'tarkari', hint: 'Bhat sanga khane' },
  { difficulty: 3, emoji: '🙏', answer: 'namaste', hint: 'Abhibadan' },
  { difficulty: 3, emoji: '🐓', answer: 'kukhura', hint: 'Bihana banchhha' },
  { difficulty: 3, emoji: '🥒', answer: 'achar', hint: 'Khana sanga' },
  { difficulty: 4, emoji: '🥛🧀', answer: 'chhurpi', hint: 'Dudh bata banne kada' },
  { difficulty: 4, emoji: '🐆', answer: 'chituwa', hint: 'Jungle ko shikari' },
  { difficulty: 4, emoji: '🦏', answer: 'gaida', hint: 'Chitwan ko ek sing' },
  { difficulty: 4, emoji: '🏔️🧗', answer: 'sherpa', hint: 'Himal ko guide' },
  { difficulty: 4, emoji: '🪔', answer: 'diyo', hint: 'Tihar ko batti' },
];
