export function scoreToDisplay(score: number): number {
  return score * 5;
}

export function scoreToLevel(score: number): number {
  const display = Math.round(scoreToDisplay(score) * 10) / 10;
  // Ranges: [0,1)→1, [1,2)→2, [2,3)→3, [3,4)→4, [4,5]→5
  return Math.min(5, Math.max(1, Math.floor(display) + 1));
}
