import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapCanvasHandle {
  post: (message: any) => void;
}

interface MapCanvasProps {
  style?: StyleProp<ViewStyle>;
  onReady: () => void;
}

const MARKER_STYLE_ID = 'corrida-pet-marker-styles';

function ensureMarkerStyles() {
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MARKER_STYLE_ID;
  style.innerHTML = `
    .pet-marker-wrapper { transition: transform 0.6s linear; }
    .pet-marker {
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FFFFFF;
      border-radius: 50%;
      border: 3px solid #E76F51;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      animation: petWalk 0.6s ease-in-out infinite;
      overflow: hidden;
    }
    .pet-marker img { width: 28px; height: 28px; }
    @keyframes petWalk {
      0%, 100% { transform: rotate(-9deg) scale(1); }
      50% { transform: rotate(9deg) scale(1.06); }
    }
    .destination-pin { font-size: 30px; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4)); }
    .owner-marker { position: relative; width: 36px; height: 36px; }
    .owner-marker-pulse {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: rgba(26, 110, 189, 0.35);
      animation: ownerPulse 2s ease-out infinite;
    }
    .owner-marker-dot {
      position: absolute;
      top: 10px;
      left: 10px;
      width: 16px;
      height: 16px;
      border-radius: 8px;
      background: #1A6EBD;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }
    @keyframes ownerPulse {
      0% { transform: scale(0.3); opacity: 0.9; }
      100% { transform: scale(1); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(({ style, onReady }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ownedLayerRef = useRef<L.LayerGroup | null>(null);
  const newLayerRef = useRef<L.LayerGroup | null>(null);
  const pathLineRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const ownerMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensureMarkerStyles();

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView(
      [-23.5505, -46.6333],
      17
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    ownedLayerRef.current = L.layerGroup().addTo(map);
    newLayerRef.current = L.layerGroup().addTo(map);
    pathLineRef.current = L.polyline([], { color: '#E76F51', weight: 4 }).addTo(map);
    routeLineRef.current = L.polyline([], {
      color: '#4285F4',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
    }).addTo(map);

    const userIcon = L.divIcon({
      className: 'pet-marker-wrapper',
      html: '<div class="pet-marker"></div>',
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
    userMarkerRef.current = L.marker([-23.5505, -46.6333], { icon: userIcon }).addTo(map);

    mapRef.current = map;
    onReady();

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    post: (message: any) => {
      const map = mapRef.current;
      const userMarker = userMarkerRef.current;
      if (!map || !userMarker) return;

      if (message.type === 'setInitialRegion') {
        map.setView([message.lat, message.lng], message.zoom || 17);
        userMarker.setLatLng([message.lat, message.lng]);
      } else if (message.type === 'setUserPosition') {
        userMarker.setLatLng([message.lat, message.lng]);
        if (message.recenter) map.setView([message.lat, message.lng]);
      } else if (message.type === 'setOwnerPosition') {
        if (!ownerMarkerRef.current) {
          const ownerIcon = L.divIcon({
            className: 'owner-marker-wrapper',
            html: '<div class="owner-marker"><div class="owner-marker-pulse"></div><div class="owner-marker-dot"></div></div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          ownerMarkerRef.current = L.marker([message.lat, message.lng], { icon: ownerIcon }).addTo(map);
        } else {
          ownerMarkerRef.current.setLatLng([message.lat, message.lng]);
        }
      } else if (message.type === 'recenter') {
        map.setView(userMarker.getLatLng(), map.getZoom());
      } else if (message.type === 'setUserIcon') {
        const icon = L.divIcon({
          className: 'pet-marker-wrapper',
          html: `<div class="pet-marker"><img src="${message.uri}" /></div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });
        userMarker.setIcon(icon);
      } else if (message.type === 'setHexagons') {
        ownedLayerRef.current?.clearLayers();
        (message.owned as [number, number][][]).forEach((coords) => {
          L.polygon(coords, { color: '#2A9D8F', fillColor: '#2A9D8F', fillOpacity: 0.3, weight: 1 }).addTo(
            ownedLayerRef.current!
          );
        });
        newLayerRef.current?.clearLayers();
        (message.newOnes as [number, number][][]).forEach((coords) => {
          L.polygon(coords, { color: '#F4A261', fillColor: '#F4A261', fillOpacity: 0.45, weight: 2 }).addTo(
            newLayerRef.current!
          );
        });
      } else if (message.type === 'setPath') {
        pathLineRef.current?.setLatLngs(message.points);
      } else if (message.type === 'setRoute') {
        routeLineRef.current?.setLatLngs(message.points);
      } else if (message.type === 'clearRoute') {
        routeLineRef.current?.setLatLngs([]);
        if (destinationMarkerRef.current) {
          map.removeLayer(destinationMarkerRef.current);
          destinationMarkerRef.current = null;
        }
      } else if (message.type === 'setDestination') {
        if (destinationMarkerRef.current) map.removeLayer(destinationMarkerRef.current);
        const destinationIcon = L.divIcon({
          className: 'destination-marker',
          html: '<div class="destination-pin">📍</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });
        destinationMarkerRef.current = L.marker([message.lat, message.lng], { icon: destinationIcon }).addTo(map);
      }
    },
  }));

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} />;
});

export default MapCanvas;
