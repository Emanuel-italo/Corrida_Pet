import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { usePetStore } from '../store/usePetStore';
import { hexToPolygon, pointToHex } from '../hex/hexUtils';
import { haversineDistanceMeters } from '../hex/geo';
import { formatDistance, formatDuration } from '../hex/format';
import { colors } from '../theme/colors';
import type { LatLng } from '../types';

const SAO_PAULO: Region = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function RunScreen() {
  const territory = usePetStore((state) => state.territory);
  const completeRun = usePetStore((state) => state.completeRun);

  const territorySet = useMemo(() => new Set(territory), [territory]);

  const mapRef = useRef<MapView | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<LatLng | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [initialRegion, setInitialRegion] = useState<Region>(SAO_PAULO);
  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState<LatLng[]>([]);
  const [runHexIds, setRunHexIds] = useState<Set<string>>(new Set());
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      const region: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      };
      setInitialRegion(region);
      setCurrentPosition({ latitude: region.latitude, longitude: region.longitude });
      mapRef.current?.animateToRegion(region, 500);
    })();

    return () => {
      subscriptionRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handlePositionUpdate = useCallback((location: Location.LocationObject) => {
    const point: LatLng = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setCurrentPosition(point);

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
    mapRef.current?.animateCamera({ center: point }, { duration: 500 });
  }, []);

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

  const newHexIdsThisRun = useMemo(
    () => Array.from(runHexIds).filter((id) => !territorySet.has(id)),
    [runHexIds, territorySet]
  );

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation followsUserLocation={isTracking}>
        {territory.map((hexId) => (
          <Polygon
            key={`owned-${hexId}`}
            coordinates={hexToPolygon(hexId)}
            fillColor={`${colors.territoryOwned}55`}
            strokeColor={colors.territoryOwned}
            strokeWidth={1}
          />
        ))}

        {newHexIdsThisRun.map((hexId) => (
          <Polygon
            key={`new-${hexId}`}
            coordinates={hexToPolygon(hexId)}
            fillColor={`${colors.territoryNew}77`}
            strokeColor={colors.territoryNew}
            strokeWidth={2}
          />
        ))}

        {path.length > 1 && <Polyline coordinates={path} strokeColor={colors.path} strokeWidth={4} />}

        {currentPosition && (
          <Marker coordinate={currentPosition} anchor={{ x: 0.5, y: 0.5 }}>
            <Text style={styles.petMarker}>🐕</Text>
          </Marker>
        )}
      </MapView>

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
  petMarker: { fontSize: 28 },
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
