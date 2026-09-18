import { Platform } from 'react-native';

// Este arquivo existe só para o TypeScript resolver o tipo de "./MapCanvas" nos imports.
// Em tempo de bundle, o Metro sempre prefere MapCanvas.native.tsx (iOS/Android) ou
// MapCanvas.web.tsx (Web) automaticamente, então o código abaixo nunca roda de fato.
export type { MapCanvasHandle } from './MapCanvas.native';

const MapCanvas = Platform.OS === 'web' ? require('./MapCanvas.web').default : require('./MapCanvas.native').default;

export default MapCanvas;
