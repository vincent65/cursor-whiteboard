// Dollars to the cent, the way a bill reads; anything under a cent says so.
export const formatCost = (usd: number): string =>
  usd > 0 && usd < 0.01 ? "under $0.01" : `$${usd.toFixed(2)}`;
