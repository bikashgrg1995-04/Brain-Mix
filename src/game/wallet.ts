export interface Wallet {
  coins(): number;
  /** Paisa pugyo bhane kati ra true, natra false (kehi ghatdaina). */
  spend(n: number): boolean;
}
