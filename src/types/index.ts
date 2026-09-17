export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RunSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceMeters: number;
  durationSeconds: number;
  hexIds: string[];
  newHexCount: number;
  xpGained: number;
}

export interface PetState {
  name: string;
  level: number;
  xp: number;
}
