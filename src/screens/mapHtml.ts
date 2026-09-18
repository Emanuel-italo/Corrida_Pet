export const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }

    .pet-marker-wrapper {
      transition: transform 0.6s linear;
    }

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

    .pet-marker img {
      width: 28px;
      height: 28px;
    }

    @keyframes petWalk {
      0%, 100% { transform: rotate(-9deg) scale(1); }
      50% { transform: rotate(9deg) scale(1.06); }
    }

    .destination-pin {
      font-size: 30px;
      filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4));
    }

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([-23.5505, -46.6333], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var ownedLayer = L.layerGroup().addTo(map);
    var newLayer = L.layerGroup().addTo(map);
    var pathLine = L.polyline([], { color: '#E76F51', weight: 4 }).addTo(map);
    var routeLine = L.polyline([], { color: '#4285F4', weight: 5, opacity: 0.9, lineCap: 'round' }).addTo(map);
    var destinationIcon = L.divIcon({
      className: 'destination-marker',
      html: '<div class="destination-pin">📍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    var destinationMarker = null;
    var userIcon = L.divIcon({
      className: 'pet-marker-wrapper',
      html: '<div class="pet-marker"></div>',
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
    var userMarker = L.marker([-23.5505, -46.6333], { icon: userIcon }).addTo(map);

    var ownerIcon = L.divIcon({
      className: 'owner-marker-wrapper',
      html: '<div class="owner-marker"><div class="owner-marker-pulse"></div><div class="owner-marker-dot"></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    var ownerMarker = null;

    function setOwnerPosition(lat, lng) {
      if (!ownerMarker) {
        ownerMarker = L.marker([lat, lng], { icon: ownerIcon }).addTo(map);
      } else {
        ownerMarker.setLatLng([lat, lng]);
      }
    }

    function setUserIcon(dataUri) {
      var icon = L.divIcon({
        className: 'pet-marker-wrapper',
        html: '<div class="pet-marker"><img src="' + dataUri + '" /></div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      userMarker.setIcon(icon);
    }

    function setHexagons(owned, newOnes) {
      ownedLayer.clearLayers();
      owned.forEach(function (coords) {
        L.polygon(coords, { color: '#2A9D8F', fillColor: '#2A9D8F', fillOpacity: 0.3, weight: 1 }).addTo(ownedLayer);
      });
      newLayer.clearLayers();
      newOnes.forEach(function (coords) {
        L.polygon(coords, { color: '#F4A261', fillColor: '#F4A261', fillOpacity: 0.45, weight: 2 }).addTo(newLayer);
      });
    }

    function setPath(points) {
      pathLine.setLatLngs(points);
    }

    function setRoute(points) {
      routeLine.setLatLngs(points);
    }

    function clearRoute() {
      routeLine.setLatLngs([]);
      if (destinationMarker) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
      }
    }

    function setDestination(lat, lng) {
      if (destinationMarker) map.removeLayer(destinationMarker);
      destinationMarker = L.marker([lat, lng], { icon: destinationIcon }).addTo(map);
    }

    function setUserPosition(lat, lng, recenter) {
      userMarker.setLatLng([lat, lng]);
      if (recenter) map.setView([lat, lng]);
    }

    function recenterOnUser() {
      map.setView(userMarker.getLatLng(), map.getZoom());
    }

    function setInitialRegion(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 17);
      userMarker.setLatLng([lat, lng]);
    }

    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'setUserPosition') setUserPosition(data.lat, data.lng, data.recenter);
        else if (data.type === 'setOwnerPosition') setOwnerPosition(data.lat, data.lng);
        else if (data.type === 'setPath') setPath(data.points);
        else if (data.type === 'setHexagons') setHexagons(data.owned, data.newOnes);
        else if (data.type === 'setInitialRegion') setInitialRegion(data.lat, data.lng, data.zoom);
        else if (data.type === 'setUserIcon') setUserIcon(data.uri);
        else if (data.type === 'setRoute') setRoute(data.points);
        else if (data.type === 'clearRoute') clearRoute();
        else if (data.type === 'setDestination') setDestination(data.lat, data.lng);
        else if (data.type === 'recenter') recenterOnUser();
      } catch (e) {}
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>
`;
