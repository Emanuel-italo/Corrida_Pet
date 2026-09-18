import type { LatLng } from '../types';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  maneuverPoint: LatLng;
}

export interface RouteResult {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

const MANEUVER_PHRASES: Record<string, string> = {
  'turn-left': 'Vire à esquerda',
  'turn-right': 'Vire à direita',
  'turn-slight left': 'Vire levemente à esquerda',
  'turn-slight right': 'Vire levemente à direita',
  'turn-sharp left': 'Vire fortemente à esquerda',
  'turn-sharp right': 'Vire fortemente à direita',
  'turn-straight': 'Siga em frente',
  'turn-uturn': 'Faça o retorno',
  'new name-straight': 'Continue em frente',
  'depart-': 'Comece seguindo em frente',
  'arrive-': 'Você chegou ao seu destino',
  'roundabout-': 'Entre na rotatória',
  'merge-': 'Continue pela via',
};

function instructionForStep(type: string, modifier: string | undefined, streetName: string): string {
  const key = `${type}-${modifier ?? ''}`;
  const phrase = MANEUVER_PHRASES[key] ?? 'Siga em frente';
  if (type === 'arrive') return phrase;
  return streetName ? `${phrase} em ${streetName}` : phrase;
}

export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const url = `https://router.project-osrm.org/route/v1/foot/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&steps=true`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;

  const route = data.routes[0];
  const coordinates: LatLng[] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
    instruction: instructionForStep(step.maneuver.type, step.maneuver.modifier, step.name),
    distanceMeters: step.distance,
    maneuverPoint: { latitude: step.maneuver.location[1], longitude: step.maneuver.location[0] },
  }));

  // A duração vinda da OSRM (servidor público de demonstração) não é confiável para o perfil "foot",
  // então estimamos com base numa velocidade média de caminhada.
  const WALKING_SPEED_METERS_PER_SECOND = 1.4;

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.distance / WALKING_SPEED_METERS_PER_SECOND,
    steps,
  };
}
