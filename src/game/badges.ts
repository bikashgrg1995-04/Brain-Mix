import { BADGES } from '../../shared/achievements';
import { DAILY_COINS } from '../../shared/rewards';
import { badgeCount, claimReward, snapshotOf, todayReward } from '../state/progress';
import { saveProfile, type Profile } from '../state/profile';
import { play } from '../audio/sfx';
import { confetti } from './fx';
import { toast } from './toast';

/** Badge screen: unlock bhayeko rangin, baaki dhamilo + progress. */
export function renderBadges(root: HTMLElement, p: Profile, onBack: () => void): void {
  const s = snapshotOf(p);
  const cards = BADGES.map((b) => {
    const got = p.badges[b.id];
    const v = Math.min(b.value(s), b.need);
    return `<li class="badge ${got ? 'got' : ''}" aria-label="${b.name}, ${got ? 'unlock bhayo' : `${v} / ${b.need}`}">
      <span class="bi" aria-hidden="true">${b.icon}</span><b>${b.name}</b><small>${b.desc}</small>
      ${got ? `<em>+${b.reward} 🪙</em>` : `<span class="bar" aria-hidden="true"><i style="width:${Math.round((v / b.need) * 100)}%"></i></span><em>${v}/${b.need} · +${b.reward} 🪙</em>`}</li>`;
  }).join('');
  root.innerHTML = `
    <div class="flags" aria-hidden="true"></div>
    <div class="game">
      <header class="gbar"><button id="back" class="icon" aria-label="Map">←</button>
        <div class="gtitle"><b>Badge</b><span>${badgeCount(p)} unlock</span></div><span class="pill">🪙 ${p.coins}</span></header>
      <ul class="badges">${cards}</ul>
    </div>`;
  root.querySelector<HTMLButtonElement>('#back')!.onclick = onBack;
}

/** Map ko mathi ko daily inam card. `onClaimed` le badge check garne. */
export function mountDaily(el: HTMLElement, p: Profile, onClaimed: () => void): void {
  const draw = (): void => {
    const v = todayReward(p);
    const strip = DAILY_COINS.map((c, i) => `<span class="dd ${i + 1 < v.day || (!v.claimable && i + 1 === v.day) ? 'past' : ''} ${v.claimable && i + 1 === v.day ? 'now' : ''}"><small>${i + 1}</small>${c}</span>`).join('');
    el.innerHTML = `<div class="daily"><div class="dtop"><b>${v.claimable ? 'Aaja ko inam' : 'Aaja ko inam liyo ✓'}</b>
      ${v.claimable ? `<button id="claim" class="primary">🪙 ${v.coins} linus</button>` : `<small>Kal: 🪙 ${v.coins}</small>`}</div>
      <div class="dstrip" aria-hidden="true">${strip}</div></div>`;
    el.querySelector<HTMLButtonElement>('#claim')?.addEventListener('click', () => {
      const r = claimReward(p);
      if (!r) return;
      saveProfile(p);
      play('coin');
      confetti(document.body, 18);
      toast(`🪙 +${r.coins} coin (din ${r.day}/7)`);
      document.querySelectorAll('.coinpill').forEach((e) => (e.textContent = `🪙 ${p.coins}`));
      draw();
      onClaimed();
    });
  };
  draw();
}
