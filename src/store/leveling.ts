export const XP_PER_NEW_HEX = 20;
export const XP_PER_KM = 15;

export function xpThresholdForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export function applyXp(
  level: number,
  xp: number,
  xpGained: number
): { level: number; xp: number; leveledUp: boolean } {
  let newLevel = level;
  let newXp = xp + xpGained;
  let leveledUp = false;

  while (newXp >= xpThresholdForLevel(newLevel)) {
    newXp -= xpThresholdForLevel(newLevel);
    newLevel += 1;
    leveledUp = true;
  }

  return { level: newLevel, xp: newXp, leveledUp };
}

export function petStageForLevel(level: number): string {
  if (level < 4) return '🐶';
  if (level < 8) return '🐕';
  if (level < 12) return '🦮';
  return '🐕‍🦺';
}
