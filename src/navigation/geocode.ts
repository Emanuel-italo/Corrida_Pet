import type { LatLng } from '../types';

export interface GeocodeResult {
  location: LatLng;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(
    query
  )}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'CorridaPetApp/1.0' },
  });

  if (!response.ok) return null;

  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (results.length === 0) return null;

  const first = results[0];
  return {
    location: { latitude: parseFloat(first.lat), longitude: parseFloat(first.lon) },
    displayName: first.display_name,
  };
}
