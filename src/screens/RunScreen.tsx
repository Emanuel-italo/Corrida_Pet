import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { usePetStore } from '../store/usePetStore';
import { hexToPolygon, pointToHex } from '../hex/hexUtils';
import { haversineDistanceMeters } from '../hex/geo';
import { formatDistance, formatDuration } from '../hex/format';
import { readPetPhotoAsBase64 } from '../media/petPhoto';
import { geocodeAddress } from '../navigation/geocode';
import { fetchWalkingRoute, RouteStep } from '../navigation/routing';
import { colors } from '../theme/colors';
import MapCanvas, { MapCanvasHandle } from './MapCanvas';
import type { LatLng } from '../types';

const SAO_PAULO: LatLng = { latitude: -23.5505, longitude: -46.6333 };
const MANEUVER_ANNOUNCE_RADIUS_METERS = 30;
const ARRIVAL_RADIUS_METERS = 25;

function toLeafletCoords(points: LatLng[]): [number, number][] {
  return points.map((p) => [p.latitude, p.longitude]);
}

function speak(text: string) {
  Speech.speak(text, { language: 'pt-BR' });
}

async function getBestEffortLocation(): Promise<LatLng | null> {
  try {
    const location = await Location.getCurrentPositionAsync({});
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  } catch {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) return { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
    } catch {
      // ignora e cai no retorno null abaixo
    }
    return null;
  }
}

interface RouteState {
  steps: RouteStep[];
  currentStepIndex: number;
  destination: LatLng | null;
}

export default function RunScreen() {
  const territory = usePetStore((state) => state.territory);
  const completeRun = usePetStore((state) => state.completeRun);
  const petPhotoUri = usePetStore((state) => state.pet.photoUri);

  const territorySet = useMemo(() => new Set(territory), [territory]);

  const mapRef = useRef<MapCanvasHandle | null>(null);
  const isMapReadyRef = useRef(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<LatLng | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeStateRef = useRef<RouteState>({ steps: [], currentStepIndex: 0, destination: null });

  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState<LatLng[]>([]);
  const [runHexIds, setRunHexIds] = useState<Set<string>>(new Set());
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [petIconDataUri, setPetIconDataUri] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<string | null>(null);
  const [remainingRouteMeters, setRemainingRouteMeters] = useState<number | null>(null);

  const postToMap = useCallback((message: object) => {
    if (!isMapReadyRef.current) return;
    mapRef.current?.post(message);
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await getBestEffortLocation();
      if (!location) return;
      postToMap({
        type: 'setInitialRegion',
        lat: location.latitude,
        lng: location.longitude,
        zoom: 17,
      });
    })();

    return () => {
      subscriptionRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!petPhotoUri) return;
    readPetPhotoAsBase64(petPhotoUri)
      .then(setPetIconDataUri)
      .catch(() => setPetIconDataUri(null));
  }, [petPhotoUri]);

  useEffect(() => {
    if (petIconDataUri) postToMap({ type: 'setUserIcon', uri: petIconDataUri });
  }, [petIconDataUri, postToMap]);

  const newHexIdsThisRun = useMemo(
    () => Array.from(runHexIds).filter((id) => !territorySet.has(id)),
    [runHexIds, territorySet]
  );

  useEffect(() => {
    postToMap({
      type: 'setHexagons',
      owned: territory.map((id) => toLeafletCoords(hexToPolygon(id))),
      newOnes: newHexIdsThisRun.map((id) => toLeafletCoords(hexToPolygon(id))),
    });
  }, [territory, newHexIdsThisRun, postToMap]);

  useEffect(() => {
    postToMap({ type: 'setPath', points: toLeafletCoords(path) });
  }, [path, postToMap]);

  const cancelRoute = useCallback(() => {
    routeStateRef.current = { steps: [], currentStepIndex: 0, destination: null };
    setCurrentInstruction(null);
    setRemainingRouteMeters(null);
    postToMap({ type: 'clearRoute' });
    Speech.stop();
  }, [postToMap]);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length === 0) return;

    setIsSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos da sua localização para traçar a rota.');
        return;
      }

      const geocoded = await geocodeAddress(query);
      if (!geocoded) {
        Alert.alert('Endereço não encontrado', 'Tente descrever o endereço de outra forma.');
        return;
      }

      const origin = await getBestEffortLocation();
      if (!origin) {
        Alert.alert('Localização indisponível', 'Não conseguimos obter sua localização atual agora.');
        return;
      }

      const route = await fetchWalkingRoute(origin, geocoded.location);
      if (!route) {
        Alert.alert('Rota não encontrada', 'Não conseguimos traçar uma rota a pé até esse endereço.');
        return;
      }

      routeStateRef.current = { steps: route.steps, currentStepIndex: 1, destination: geocoded.location };
      setRemainingRouteMeters(route.distanceMeters);

      postToMap({ type: 'setDestination', lat: geocoded.location.latitude, lng: geocoded.location.longitude });
      postToMap({ type: 'setRoute', points: toLeafletCoords(route.coordinates) });

      const firstInstruction = route.steps[0]?.instruction ?? 'Siga em frente';
      setCurrentInstruction(firstInstruction);
      speak(`Rota traçada. ${formatDistance(route.distanceMeters)}. ${firstInstruction}`);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível buscar esse endereço agora.');
    } finally {
      setIsSearching(false);
    }
  }, [postToMap, searchQuery]);

  const handlePositionUpdate = useCallback(
    (location: Location.LocationObject) => {
      const point: LatLng = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      postToMap({ type: 'setUserPosition', lat: point.latitude, lng: point.longitude, recenter: true });

      if (lastPointRef.current) {
        const delta = haversineDistanceMeters(lastPointRef.current, point);
        if (delta > 1) {
          setDistanceMeters((prev) => prev + delta);
        }
      }
      lastPointRef.current = point;

      const hexId = pointToHex(point);
      setRunHexIds((prev) => {
        if (prev.has(hexId)) return prev;
        const next = new Set(prev);
        next.add(hexId);
        return next;
      });

      setPath((prev) => [...prev, point]);

      const routeState = routeStateRef.current;
      if (routeState.destination) {
        const distanceToDestination = haversineDistanceMeters(point, routeState.destination);
        setRemainingRouteMeters(distanceToDestination);

        if (distanceToDestination < ARRIVAL_RADIUS_METERS) {
          speak('Você chegou ao seu destino!');
          cancelRoute();
        } else if (routeState.currentStepIndex < routeState.steps.length - 1) {
          const step = routeState.steps[routeState.currentStepIndex];
          const distanceToManeuver = haversineDistanceMeters(point, step.maneuverPoint);
          if (distanceToManeuver < MANEUVER_ANNOUNCE_RADIUS_METERS) {
            const nextIndex = routeState.currentStepIndex + 1;
            routeStateRef.current = { ...routeState, currentStepIndex: nextIndex };
            const nextInstruction = routeState.steps[nextIndex]?.instruction;
            if (nextInstruction) {
              speak(nextInstruction);
              setCurrentInstruction(nextInstruction);
            }
          }
        }
      }
    },
    [postToMap, cancelRoute]
  );

  const startRun = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos da sua localização para acompanhar a corrida.');
      return;
    }

    setPath([]);
    setRunHexIds(new Set());
    setDistanceMeters(0);
    setElapsedSeconds(0);
    lastPointRef.current = null;
    setIsTracking(true);

    subscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 8 },
      handlePositionUpdate
    );

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, [handlePositionUpdate]);

  const stopRun = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTracking(false);

    const summary = completeRun({
      hexIds: Array.from(runHexIds),
      distanceMeters,
      durationSeconds: elapsedSeconds,
    });

    Alert.alert(
      'Corrida concluída!',
      `Território novo: ${summary.newHexCount} hexágono(s)\nDistância: ${formatDistance(summary.distanceMeters)}\nXP ganho: +${summary.xpGained}`
    );
  }, [completeRun, distanceMeters, elapsedSeconds, runHexIds]);

  const handleWebViewLoad = useCallback(() => {
    isMapReadyRef.current = true;
    postToMap({ type: 'setInitialRegion', lat: SAO_PAULO.latitude, lng: SAO_PAULO.longitude, zoom: 17 });
    postToMap({
      type: 'setHexagons',
      owned: territory.map((id) => toLeafletCoords(hexToPolygon(id))),
      newOnes: [],
    });
    if (petIconDataUri) postToMap({ type: 'setUserIcon', uri: petIconDataUri });
  }, [postToMap, territory, petIconDataUri]);

  return (
    <View style={styles.container}>
      <MapCanvas ref={mapRef} style={styles.map} onReady={handleWebViewLoad} />

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar endereço (ex: Av. Paulista, 1106)"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
          {isSearching ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.searchButtonText}>🔍</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.recenterButton} onPress={() => postToMap({ type: 'recenter' })}>
        <Text style={styles.recenterButtonText}>🎯</Text>
      </TouchableOpacity>

      {currentInstruction && (
        <View style={styles.instructionBanner}>
          <View style={styles.instructionTextBlock}>
            <Text style={styles.instructionText}>{currentInstruction}</Text>
            {remainingRouteMeters != null && (
              <Text style={styles.instructionDistance}>{formatDistance(remainingRouteMeters)} restantes</Text>
            )}
          </View>
          <TouchableOpacity onPress={cancelRoute}>
            <Text style={styles.cancelRouteText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(distanceMeters)}</Text>
          <Text style={styles.statLabel}>Distância</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
          <Text style={styles.statLabel}>Tempo</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{newHexIdsThisRun.length}</Text>
          <Text style={styles.statLabel}>Hexágonos novos</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, isTracking ? styles.buttonStop : styles.buttonStart]}
        onPress={isTracking ? stopRun : startRun}
      >
        <Text style={styles.buttonText}>{isTracking ? 'Finalizar corrida' : 'Começar corrida'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  searchButtonText: { fontSize: 18 },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 190,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  recenterButtonText: { fontSize: 20 },
  instructionBanner: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
  },
  instructionTextBlock: { flex: 1 },
  instructionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  instructionDistance: { color: '#FFFFFF', fontSize: 12, marginTop: 2, opacity: 0.9 },
  cancelRouteText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', paddingLeft: 10 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  button: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonStart: { backgroundColor: colors.primary },
  buttonStop: { backgroundColor: colors.primaryDark },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
