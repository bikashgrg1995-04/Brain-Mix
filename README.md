# Shabda: Phase 1 scaffold (Facebook-first)

Browser ma khelna milne core game. Variable word length (4-7), difficulty anusar tries ra XP, Facebook Instant Games adapter (mock + real).

## Chalaune
```
npm install
npm run dev        # browser ma khel (mock adapter)
npm test           # evaluate, xp, normalize tests
npm run typecheck
npm run bundle     # Facebook bundle: dist/ + shabda-fb.zip (index.html root ma)
```

## Folder
```
shared/        evaluate, xp, normalize, types (pachhi server Edge Function ma pani yahi code)
src/platform/  adapter.ts (interface), mock.ts, facebook.ts
src/game/      chapters.ts (10 adhyay data), map.ts (level map = first screen), icons.ts, nav.ts, words.ts (SAMPLE words), home.ts (home screen), ui.ts (game), scenery.ts (thau ko painted background), theme.ts (thau anusar accent + background)
src/state/     profile.ts (XP, streak, daily: TEMP localStorage)
public/fbapp-config.json
tests/
```

## Dhyan dine kura
- `words.ts` ko 20 words sample matra. Canonical spelling tapai le final garnus.
- Phase 1 ma answer client ma chha ra kunai pani sahi length ko a-z guess accept hunchha (`ALLOW_ANY_GUESS`). Phase 2 ma server (`submit_guess`) ra valid-guess list ma sarne.
- `fbapp-config.json` ra SDK URL (`fbinstant.8.0.js`) Meta ko current docs sanga verify garnus. Maile network bata check garna sakeko chhaina.
- Facebook ma mic permission test (voice) hapta 1 ma sano alag test page le garne.

## Meta side (Facebook ma test garna)
1. developers.facebook.com ma app banaune, Instant Games product thapne.
2. Instant Games settings ma Zero Permissions enable garne.
3. `npm run bundle` ko zip Web Hosting ma upload, Play thichera test (app ma role bhaeka manche matra khelna paaucha).
4. Launch aagadi: privacy policy URL, App Domains, App Review (Instant Games Zero Permission Access).

## Phase 1 checklist
- [x] Repo, TypeScript, Vite, tests
- [x] evaluate() variable length + repeated letters
- [x] XP by difficulty (shared/xp.ts)
- [x] Grid + keyboard + share grid
- [x] PlatformAdapter (mock, facebook)
- [ ] `npm install` ra `npm test` aafno machine ma chalaune
- [ ] 100+ words ra valid-guess list (4/5/6/7)
- [ ] Phone browser ma 7-column grid check
- [ ] Facebook ma bundle upload ra test
- [ ] Mic spike

## Level map (first screen)
- 10 adhyay x 10 level = 100. Level 1 = Nepal ko sabai bhanda tallo thau (Mukhiyapatti, Dhanusha, 59 m), level 100 = Sagarmatha (8,849 m). Thau: Mukhiyapatti, Janakpur, Lumbini, Chitwan, Pokhara, Gorkha, Kathmandu, Namche, Mustang, Sagarmatha. Chapter data `src/game/chapters.ts` ma: place, landmark/khana (DRAFT, verify garnus), altitude (Gorkha ra Chitwan ko approx), icon, difficulty band, hint level, theme.
- Thau anusar badlinchha: background (`scenery.ts`), accent rang (`theme.ts`), altitude ra difficulty. Map scroll garda mathi ko bar ma afai badlinchha; game screen ko mathi ma pani tyo thau ko background aaucha.
- Difficulty mathi jaada badhchha: Mukhiyapatti Easy, ..., Sagarmatha Expert (`band` in chapters.ts). Altitude ra band kahile ghatdaina (test chha).
- Accent rang light ra dark duitai mode ma 4.5:1 contrast chahinchha; `tests/chapters.test.ts` le check garchha.
- 'Sabai bhanda tallo thau' bivadit chha: Kechana Kawal (Jhapa, ~70 m) purano record; 2017 ko survey le Mukhiyapatti (Dhanusha, 59 m) lai tallo bhanyo. Badlinu parya `chapters.ts` ko pahilo entry.
- Level ko word `levelWord(i)` le chhanchha (adhyay ko difficulty band bhitra). Sample 20 words le dherai repeat hunchha, 100 words pachhi thik hunchha.
- Stars: 1-2 try = 3, 3-4 = 2, 5-6 = 1. XP pahilo clear ma matra.
- Dev: `http://localhost:5173/?unlock=1` le sabai level khulchha.
- Progress localStorage ma (TEMP), Phase 2 ma server.

## Admin (quest set garne)
- `npm run admin` -> `/admin.html` khulchha. Place chuna, level chuna, quest lekha.
- Quest type: word (a-z, 4-7 letter), quiz (4 option, 1 sahi), photo (1-3 emoji + answer). Difficulty 1-4, timer 10-300s, category/hint optional.
- Draft browser ma auto-save huncha. **Save to project** le `src/content/quests.json` ma lekhchha (dev server matra; localhost ma). Production ma Download/Import JSON.
- Game ma admin quest sabai type khelinchha (word, quiz, photo). Quest set gareko level ma sadhai tehi aauchha.
- Admin game/FB bundle ma jadaina. Phase 2 ma Supabase + login admin.

## Random round (level ma admin quest chhaina bhane)
Har level ma random type aauchha (tauli: grid 4, quiz 2, photo 2, rush 2), difficulty place ko band bhitra, level badhdai badhne.
- **Grid**: Wordle (4-7 akshar), 60s timer. Samay sakiyo bhane haar.
- **Quiz**: 4 option MCQ, 30s. Option random order. Chhito sahi jawaf = dherai star.
- **Chitra shabda**: emoji bata shabda, 60s, 3 try.
- **Rush**: 5 shabda, 90s ko ek timer. Har shabda ek patak, 100 point max: sahi thau ma sahi akshar = 1, galat thau ma = 0.5 (`shared/score.ts`). Jamma 50%+ bhaye pass, 70% = 2 star, 90% = 3 star.
- Sawal bank: `src/game/bank.ts` (SAMPLE, tapai le thapne). Round picker: `src/game/rounds.ts`. "Feri khel" ma aghilo item dohoriudaina.

## Multiplayer (online, max 5 jana)
Supabase **Realtime** matra: table, SQL, login kehi chahidaina.
- Setup: Supabase project banau > Project Settings > API bata URL ra **anon** key lyau > `.env.example` lai `.env.local` ma copy garera bharau > `npm run dev`. FB build ko lagi pani build garda yehi env chahinchha (`VITE_*` build time ma bundle hunchha).
- Room: host le "Room banau" garchha, 5 akshar ko code aauchha (share garne). Arule code halera jodinchhan. 2-5 jana. Host le "Suru garau" thichchha.
- Khel: 5 round (quiz / chitra shabda / rush, sajilo bata kathin). Sabai ko samane eutai sawal, sabai ko afnai timer. Quiz/photo ma sahi + chhito = 100 + bonus (max 150). Photo ma pura sahi nabhaye placement anusar (max 99). Rush: 5 shabda ko placement ko ausat (max 100).
- Cheat nagarna: host le sahi jawaf kasai lai pathaudaina, kheladdi le afno jawaf matra pathaunchha, host le score garchha (`shared/multiplayer.ts`).
- Limits: host ko phone ra internet chahinchha (host chhodyo bhane room band). Khel suru bhaepachhi naya jodna ra bichma phirna (rejoin) milena. Public anon channel: kasaile code thaha payo bhane jodna sakchha. Phase 2 ma Edge Function ma sarne.
- Code: `src/mp/session.ts` (host + player logic, transport bata alag), `src/mp/supabase.ts` (Realtime), `src/mp/ui.ts`, `tests/multiplayer.test.ts` (pura khel in-memory simulate).

## Awaj (ambient sound)
- Code ma banako (Web Audio): kunai audio file, recording ya licence chaidaina. Hawa, nadi, charaa, mandir ko ghanta, bazaar ko awaj.
- Har thau ko afnai mix (`sound` in `src/game/chapters.ts`). Map scroll garda ya level kholda thau anusar awaj bistarai badlinchha (Mukhiyapatti: charaa + dhan khet, Sagarmatha: hawa matra).
- Browser le tap pachhi matra awaj dinchha, tesaile pahilo tap/key ma suru huncha. Tala ko nav ma 🔊/🔇 button, choice yaad rahanchha. Tab background ma gayepachhi ruknchha.
- Home/Daily/Practice ra Multi ma awaj chaidaina bhane chup huncha (`applyTheme(null)`).

## Khel ramailo banaune (juice, coin, power-up)
- **Animation**: shabda submit garda tile ek-ek gari palto, galat input ma row halne, typing ma pop, jitda confetti ra star pop, samay 10s vitra timer blink. `prefers-reduced-motion` ma sabai band.
- **Awaj/haptic**: tap, sahi, galat, jit, haar, coin, last 5s tick (Web Audio, file chhaina, `src/audio/sfx.ts`). Phone ma halka vibrate. 🔊/🔇 le ambient ra effects dubai band.
- **Coin 🪙**: naya khelaadi 30 coin. Level pahilo patak jitda har star ko 10 coin (replay ma chhaina). Map ko mathi ma dekhinchha.
- **Power-up** (level ma): 💡 Akshar (ek sahi akshar dekhaucha, daam = difficulty ko hint cost 10/10/15/25), ✂️ 50:50 (quiz ma 2 galat option hataucha), ⏱ +15s (10 coin). Niyam `shared/powerups.ts`.
- Phase 2 ma: coin server ma, "video herera coin" (rewarded ad) = paisa kamaune thau.

## Daily inam ra Badge
- **Daily inam**: map ko mathi ma card. Roj ek patak linus: 7 din ko cycle, 🪙 10, 15, 20, 25, 30, 40, 60. Ek din chhutyo bhane feri din 1 bata (`shared/rewards.ts`, Nepal ko din anusar).
- **Badge (20 ota)**: 🏅 button ma herne. Level/star/thau pura, quiz/photo/rush jit, perfect (3 taara), daily streak, power-up prayog, multiplayer khelne/jitne. Har badge ko coin inam, unlock hudaa toast + awaj + confetti (`shared/achievements.ts`).
- Ginti `profile.stats` ma, purano save pani chalchha. Phase 2 ma server ma sarnu parchha (coin/inam client ma cheat hune sakchha).

## Server ma coin/XP/badge (Supabase, Phase 2)
Supabase env (`.env.local`) halyo bhane coin, XP, badge, daily inam ko hisab **server** le garchha; nabhae purano jastai local. Client le "kati coin paye" bhandaina, "kun level jite" matra bhancha.
- **Setup (ek patak)**: (1) Dashboard > Authentication > Sign In / Providers > **Allow anonymous sign-ins** on. (2) `supabase link --project-ref <ref>` ra `supabase db push` (`supabase/migrations/…players.sql`: `players` table, RLS on, kunai policy chhaina => client le seedha lekhna sakdaina). (3) `npm run build:server && supabase functions deploy game`. (4) `.env.local` ma URL ra anon key.
- **Server ko niyam** (`server/game.ts`, shared/ ko niyam tehi reuse): level unlock krama (skip nahune), star badhne matra, XP/coin/badge server le nikalchha, power-up ko daam server ko (difficulty thau ko band ma clamp), daily inam Nepal ko din anusar ek patak, daily shabda ek patak, multiplayer result 60s ma ek patak, tez-gati rate limit. `tests/server.test.ts`, `tests/sync.test.ts`.
- **Local-first**: khelda turuntai dekhinchha, ghatana outbox ma (`shabda_outbox_v1`) basera server ma jancha. Internet nabhae basxa, aaepachhi order ma pugchha. Server ko number le local lai thik pardchha. Pahilo patak purano local progress import huncha (XP 5000, coin 500 samma, badge server le feri dinchha).
- **Sima (imaandaari)**: jawaf client ma chha, tesaile "jite" bhanne dabi server le pakka verify garna sakdaina (unlock krama, rate limit le matra roknchha). Pakka upaya: round ra jawaf server le dine (arko phase). Anonymous login ek device/browser ma matra: arko phone ma same progress ko lagi Facebook player id ya email login chahinchha. Edge function Deno ma maile asal chalayera test garekoina (logic Node ma test gareko).
#   B r a i n - M i x  
 