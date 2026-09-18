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

export interface FrameTier {
  name: string;
  color: string;
  badge: string;
}

const FRAME_TIERS: FrameTier[] = [
  { name: 'Iniciante', color: '#B08968', badge: '' },
  { name: 'Bronze', color: '#CD7F32', badge: '🥉' },
  { name: 'Prata', color: '#C0C0C0', badge: '🥈' },
  { name: 'Ouro', color: '#FFD700', badge: '🥇' },
  { name: 'Diamante', color: '#5EC5E8', badge: '💎' },
];

export function frameTierForLevel(level: number): FrameTier {
  if (level >= 20) return FRAME_TIERS[4];
  if (level >= 12) return FRAME_TIERS[3];
  if (level >= 6) return FRAME_TIERS[2];
  if (level >= 3) return FRAME_TIERS[1];
  return FRAME_TIERS[0];
}

// Decaimento por hora sem atividade.
export const HUNGER_DECAY_PER_HOUR = 2;
export const ENERGY_DECAY_PER_HOUR = 1.5;

export function currentNeedValue(storedValue: number, lastUpdate: number, decayPerHour: number): number {
  const hoursElapsed = (Date.now() - lastUpdate) / (1000 * 60 * 60);
  return Math.max(0, Math.min(100, storedValue - hoursElapsed * decayPerHour));
}

export interface MoodInfo {
  label: string;
  emoji: string;
}

export function moodForNeeds(hunger: number, energy: number): MoodInfo {
  const average = (hunger + energy) / 2;
  if (average >= 70) return { label: 'Feliz', emoji: '😄' };
  if (average >= 40) return { label: 'Neutro', emoji: '🙂' };
  return { label: 'Triste', emoji: '😢' };
}
