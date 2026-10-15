/** Shared colour ramp for the 0–100 convergence score (server- and client-safe). */
export const scoreColor = (v: number) =>
  v >= 85 ? '#2fd4a7' : v >= 70 ? '#7c5cff' : v >= 55 ? '#ffc247' : '#666e87';
