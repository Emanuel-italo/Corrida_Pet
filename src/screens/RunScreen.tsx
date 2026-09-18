import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePetStore } from '../store/usePetStore';
import { haversineDistanceMeters } from '../hex/geo';
import { formatDistance, formatDuration } from '../hex/format';
import { readPetPhotoAsBase64 } from '../media/petPhoto';
import { fetchWalkingRoute, RouteStep } from '../navigation/routing';
import { colors } from '../theme/colors';
import MapCanvas, { MapCanvasHandle } from './MapCanvas';
import type { LatLng } from '../types';

const SAO_PAULO: LatLng = { latitude: -23.5505, longitude: -46.6333 };
const MANEUVER_ANNOUNCE_RADIUS_METERS = 30;
const ARRIVAL_RADIUS_METERS = 25;

// Largura máxima dos painéis flutuantes em telas largas (desktop web), para não
// esticarem de ponta a ponta. Sem efeito no celular, que já é mais estreito.
const CHROME_MAX_WIDTH = 480;
// Espaço reservado no rodapé para a tab bar flutuante (ver App.tsx) não cobrir o botão.
const TAB_BAR_CLEARANCE = 96;

// A coleira real ainda não está integrada: até lá, simulamos o sinal
// (posição inicial próxima ao dono + variação leve a cada tick) para validar o fluxo de busca.
const PET_SIGNAL_MIN_METERS = 150;
const PET_SIGNAL_MAX_METERS = 600;
const PET_SIGNAL_JITTER_METERS = 12;
const PET_SIGNAL_INTERVAL_MS = 4000;

interface PetSignal {
  position: LatLng;
  updatedAt: number;
  batteryPercent: number;
}

interface RouteState {
  steps: RouteStep[];
  currentStepIndex: number;
  destination: LatLng | null;
}

function toLeafletCoords(points: LatLng[]): [number, number][] {
  return points.map((p) => [p.latitude, p.longitude]);
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

function offsetCoordinate(origin: LatLng, distanceMeters: number, bearingDegrees: number): LatLng {
  const earthRadius = 6371000;
  const bearingRad = (bearingDegrees * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lon1 = (origin.longitude * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadius;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

function generateSimulatedPetSignal(origin: LatLng): PetSignal {
  const distance = PET_SIGNAL_MIN_METERS + Math.random() * (PET_SIGNAL_MAX_METERS - PET_SIGNAL_MIN_METERS);
  const bearing = Math.random() * 360;
  return {
    position: offsetCoordinate(origin, distance, bearing),
    updatedAt: Date.now(),
    batteryPercent: Math.round(55 + Math.random() * 40),
  };
}

function jitterPetSignal(previous: PetSignal): PetSignal {
  return {
    position: offsetCoordinate(previous.position, Math.random() * PET_SIGNAL_JITTER_METERS, Math.random() * 360),
    updatedAt: Date.now(),
    batteryPercent: Math.max(12, previous.batteryPercent - (Math.random() < 0.2 ? 1 : 0)),
  };
}

function formatSignalAge(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  return `há ${Math.round(seconds / 60)} min`;
}

export default function RunScreen() {
  const completeRun = usePetStore((state) => state.completeRun);
  const petPhotoUri = usePetStore((state) => state.pet.photoUri);
  const petName = usePetStore((state) => state.pet.name);
  const voiceIdentifier = usePetStore((state) => state.voiceIdentifier);
  const setVoiceIdentifier = usePetStore((state) => state.setVoiceIdentifier);
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapCanvasHandle | null>(null);
  const isMapReadyRef = useRef(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const jitterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<LatLng | null>(null);
  const ownerPositionRef = useRef<LatLng | null>(null);
  const petSignalRef = useRef<PetSignal | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const routeStateRef = useRef<RouteState>({ steps: [], currentStepIndex: 0, destination: null });

  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState<LatLng[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [distanceToPet, setDistanceToPet] = useState<number | null>(null);
  const [petSignal, setPetSignal] = useState<PetSignal | null>(null);
  const [petIconDataUri, setPetIconDataUri] = useState<string | null>(null);
  const [currentInstruction, setCurrentInstruction] = useState<string | null>(null);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);

  const postToMap = useCallback((message: object) => {
    if (!isMapReadyRef.current) return;
    mapRef.current?.post(message);
  }, []);

  const speak = useCallback(
    (text: string, overrideVoiceIdentifier?: string) => {
      Speech.speak(text, {
        language: 'pt-BR',
        volume: 1.0,
        voice: overrideVoiceIdentifier ?? voiceIdentifier ?? undefined,
      });
    },
    [voiceIdentifier]
  );

  const cycleVoice = useCallback(() => {
    if (voices.length === 0) {
      Alert.alert('Nenhuma voz encontrada', 'Não encontramos outras vozes em português neste aparelho.');
      return;
    }
    const currentIndex = voices.findIndex((v) => v.identifier === voiceIdentifier);
    const next = voices[(currentIndex + 1) % voices.length];
    setVoiceIdentifier(next.identifier);
    Speech.stop();
    speak(`Voz alterada para ${next.name}.`, next.identifier);
  }, [voices, voiceIdentifier, setVoiceIdentifier, speak]);

  const testAudio = useCallback(() => {
    Speech.stop();
    Speech.speak('Teste de áudio. Você está ouvindo esta mensagem?', {
      language: 'pt-BR',
      volume: 1.0,
      voice: voiceIdentifier ?? undefined,
      onDone: () => {
        Alert.alert('Conseguiu ouvir?', 'Confirme se o áudio tocou com clareza.', [
          {
            text: 'Não ouvi',
            onPress: () =>
              Alert.alert(
                'Aumente o volume',
                'Seu aparelho pode estar com o volume baixo ou no silencioso. Aumente o volume pelos botões físicos ou nas configurações de mídia e toque em "Testar áudio" de novo.'
              ),
          },
          { text: 'Sim, ouvi' },
        ]);
      },
      onError: () => {
        Alert.alert('Não foi possível tocar o áudio', 'Verifique se o aparelho não está no modo silencioso e tente novamente.');
      },
    });
  }, [voiceIdentifier]);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((allVoices) => {
        const ptVoices = allVoices.filter((v) => v.language?.toLowerCase().startsWith('pt'));
        setVoices(ptVoices.length > 0 ? ptVoices : allVoices);
      })
      .catch(() => setVoices([]));
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
      postToMap({ type: 'setOwnerPosition', lat: location.latitude, lng: location.longitude });
    })();

    return () => {
      subscriptionRef.current?.remove();
      if (jitterTimerRef.current) clearInterval(jitterTimerRef.current);
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

  useEffect(() => {
    postToMap({ type: 'setPath', points: toLeafletCoords(path) });
  }, [path, postToMap]);

  const cancelRoute = useCallback(() => {
    routeStateRef.current = { steps: [], currentStepIndex: 0, destination: null };
    setCurrentInstruction(null);
    postToMap({ type: 'clearRoute' });
    Speech.stop();
  }, [postToMap]);

  const handleOwnerPositionUpdate = useCallback(
    (location: Location.LocationObject) => {
      const point: LatLng = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      ownerPositionRef.current = point;
      postToMap({ type: 'setOwnerPosition', lat: point.latitude, lng: point.longitude });

      if (lastPointRef.current) {
        const delta = haversineDistanceMeters(lastPointRef.current, point);
        if (delta > 1) setDistanceMeters((prev) => prev + delta);
      }
      lastPointRef.current = point;
      setPath((prev) => [...prev, point]);

      if (petSignalRef.current) {
        setDistanceToPet(haversineDistanceMeters(point, petSignalRef.current.position));
      }

      const routeState = routeStateRef.current;
      if (routeState.destination) {
        const distanceToDestination = haversineDistanceMeters(point, routeState.destination);

        if (distanceToDestination < ARRIVAL_RADIUS_METERS) {
          speak('Você encontrou seu pet!');
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
    [cancelRoute, speak, postToMap]
  );

  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos da sua localização para te guiar até o pet.');
      return;
    }

    const origin = await getBestEffortLocation();
    if (!origin) {
      Alert.alert('Localização indisponível', 'Não conseguimos obter sua localização atual agora.');
      return;
    }

    setPath([]);
    setDistanceMeters(0);
    lastPointRef.current = null;
    ownerPositionRef.current = origin;
    sessionStartRef.current = Date.now();
    postToMap({ type: 'setOwnerPosition', lat: origin.latitude, lng: origin.longitude });

    const signal = generateSimulatedPetSignal(origin);
    petSignalRef.current = signal;
    setPetSignal(signal);
    setDistanceToPet(haversineDistanceMeters(origin, signal.position));

    postToMap({
      type: 'setUserPosition',
      lat: signal.position.latitude,
      lng: signal.position.longitude,
      recenter: true,
    });

    setIsTracking(true);

    subscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 8 },
      handleOwnerPositionUpdate
    );

    jitterTimerRef.current = setInterval(() => {
      setPetSignal((prev) => {
        if (!prev) return prev;
        const next = jitterPetSignal(prev);
        petSignalRef.current = next;
        postToMap({ type: 'setUserPosition', lat: next.position.latitude, lng: next.position.longitude, recenter: false });
        if (routeStateRef.current.destination) {
          routeStateRef.current = { ...routeStateRef.current, destination: next.position };
        }
        if (ownerPositionRef.current) {
          setDistanceToPet(haversineDistanceMeters(ownerPositionRef.current, next.position));
        }
        return next;
      });
    }, PET_SIGNAL_INTERVAL_MS);

    try {
      const route = await fetchWalkingRoute(origin, signal.position);
      if (route) {
        routeStateRef.current = { steps: route.steps, currentStepIndex: 1, destination: signal.position };
        postToMap({ type: 'setRoute', points: toLeafletCoords(route.coordinates) });
        const firstInstruction = route.steps[0]?.instruction ?? 'Siga em frente';
        setCurrentInstruction(firstInstruction);
        speak(`Sinal da coleira encontrado. Seu pet está a ${formatDistance(route.distanceMeters)}. ${firstInstruction}`);
      } else {
        speak('Sinal da coleira encontrado. Siga em direção ao pet no mapa.');
      }
    } catch {
      // a rota é um complemento visual; a busca continua funcionando mesmo se ela falhar
    }
  }, [postToMap, handleOwnerPositionUpdate, speak]);

  const stopTracking = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (jitterTimerRef.current) {
      clearInterval(jitterTimerRef.current);
      jitterTimerRef.current = null;
    }
    setIsTracking(false);
    cancelRoute();

    const durationSeconds = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 1000) : 0;
    sessionStartRef.current = null;

    const summary = completeRun({ hexIds: [], distanceMeters, durationSeconds });

    Alert.alert(
      'Busca encerrada',
      `Você percorreu ${formatDistance(distanceMeters)} em ${formatDuration(durationSeconds)} procurando seu pet.\nXP ganho: +${summary.xpGained}`
    );

    setPetSignal(null);
    petSignalRef.current = null;
    setDistanceToPet(null);
  }, [cancelRoute, completeRun, distanceMeters]);

  const handleWebViewLoad = useCallback(() => {
    isMapReadyRef.current = true;
    postToMap({ type: 'setInitialRegion', lat: SAO_PAULO.latitude, lng: SAO_PAULO.longitude, zoom: 17 });
    if (petIconDataUri) postToMap({ type: 'setUserIcon', uri: petIconDataUri });
  }, [postToMap, petIconDataUri]);

  return (
    <View style={styles.container}>
      <MapCanvas ref={mapRef} style={StyleSheet.absoluteFill} onReady={handleWebViewLoad} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topColumn, { paddingTop: insets.top + 16 }]} pointerEvents="box-none">
          <View style={styles.petStatusCard}>
            {petPhotoUri && <Image source={{ uri: petPhotoUri }} style={styles.petStatusPhoto} />}
            <View style={styles.petStatusTextBlock}>
              <Text style={styles.petStatusName}>{petName}</Text>
              <View style={styles.petStatusSubRow}>
                {isTracking && petSignal && <View style={styles.statusDotActive} />}
                {isTracking && !petSignal && <View style={styles.statusDotSearching} />}
                {!isTracking && <View style={styles.statusDotIdle} />}
                <Text style={styles.petStatusSub}>
                  {isTracking
                    ? petSignal
                      ? `Sinal ativo · ${formatSignalAge(Date.now() - petSignal.updatedAt)}`
                      : 'Buscando sinal da coleira...'
                    : 'Coleira parada'}
                </Text>
              </View>
            </View>
            <View style={styles.petStatusActions}>
              <TouchableOpacity style={styles.iconButton} onPress={cycleVoice}>
                <Ionicons name="volume-high-outline" size={17} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={testAudio}>
                <Ionicons name="play-circle-outline" size={17} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {currentInstruction && (
            <View style={styles.instructionBanner}>
              <View style={styles.instructionTextBlock}>
                <Text style={styles.instructionText}>{currentInstruction}</Text>
                {distanceToPet != null && (
                  <Text style={styles.instructionDistance}>{formatDistance(distanceToPet)} até o pet</Text>
                )}
              </View>
              <TouchableOpacity onPress={cancelRoute}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.middleRow} pointerEvents="box-none">
          <TouchableOpacity style={styles.recenterButton} onPress={() => postToMap({ type: 'recenter' })}>
            <Ionicons name="locate" size={16} color={colors.text} />
            <Text style={styles.recenterButtonText}>Centralizar no pet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomColumn} pointerEvents="box-none">
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.primary} />
              <Text style={styles.statValue}>{distanceToPet != null ? formatDistance(distanceToPet) : '--'}</Text>
              <Text style={styles.statLabel}>Até o pet</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="pulse-outline" size={16} color={colors.primary} />
              <Text style={styles.statValue}>
                {petSignal ? formatSignalAge(Date.now() - petSignal.updatedAt) : '--'}
              </Text>
              <Text style={styles.statLabel}>Sinal</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="battery-half-outline" size={16} color={colors.primary} />
              <Text style={styles.statValue}>{petSignal ? `${petSignal.batteryPercent}%` : '--'}</Text>
              <Text style={styles.statLabel}>Bateria coleira</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isTracking ? styles.buttonStop : styles.buttonStart]}
            onPress={isTracking ? stopTracking : startTracking}
          >
            {!isTracking && <Ionicons name="paw" size={18} color="#FFFFFF" style={styles.buttonIcon} />}
            <Text style={styles.buttonText}>{isTracking ? 'Parar rastreamento' : 'Localizar meu pet'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  topColumn: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  middleRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bottomColumn: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  petStatusCard: {
    width: '100%',
    maxWidth: CHROME_MAX_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  petStatusPhoto: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primary },
  petStatusTextBlock: { flex: 1 },
  petStatusName: { fontSize: 16, fontWeight: '800', color: colors.text },
  petStatusSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusDotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  statusDotSearching: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.path },
  statusDotIdle: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  petStatusSub: { fontSize: 12, color: colors.textMuted },
  petStatusActions: { flexDirection: 'row', gap: 6 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  recenterButtonText: { fontSize: 13, fontWeight: '700', color: colors.text },
  instructionBanner: {
    width: '100%',
    maxWidth: CHROME_MAX_WIDTH,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  instructionTextBlock: { flex: 1 },
  instructionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  instructionDistance: { color: '#FFFFFF', fontSize: 12, marginTop: 2, opacity: 0.9 },
  statsBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  statItem: { alignItems: 'center', flex: 1, gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  button: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 17,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonStart: { backgroundColor: colors.primary },
  buttonStop: { backgroundColor: colors.primaryDark },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
