import { latLngToCell, cellToBoundary } from 'h3-js';
import type { LatLng } from '../types';

// Resolução 10 (~15.000 m², borda de rua/quarteirão), boa escala para caminhada/corrida com o pet.
export const HEX_RESOLUTION = 10;

export function pointToHex(point: LatLng): string {
  return latLngToCell(point.latitude, point.longitude, HEX_RESOLUTION);
}

export function hexToPolygon(hexId: string): LatLng[] {
  return cellToBoundary(hexId).map(([latitude, longitude]) => ({ latitude, longitude }));
}
