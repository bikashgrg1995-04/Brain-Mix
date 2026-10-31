export type PowerItem = 'hint' | 'fifty' | 'time';

export interface Wallet {
  coins(): number;
  /** Paisa pugyo bhane kati ra true, natra false (kehi ghatdaina). item/difficulty server ko lagi (daam server le afai nikalchha). */
  spend(item: PowerItem, cost: number, difficulty: number): boolean;
}
