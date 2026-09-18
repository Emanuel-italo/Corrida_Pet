import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from './mapHtml';

export interface MapCanvasHandle {
  post: (message: object) => void;
}

interface MapCanvasProps {
  style?: StyleProp<ViewStyle>;
  onReady: () => void;
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(({ style, onReady }, ref) => {
  const webviewRef = useRef<WebView | null>(null);

  useImperativeHandle(ref, () => ({
    post: (message) => webviewRef.current?.postMessage(JSON.stringify(message)),
  }));

  return (
    <WebView
      ref={webviewRef}
      style={style}
      originWhitelist={['*']}
      source={{ html: MAP_HTML }}
      onLoadEnd={onReady}
      javaScriptEnabled
      domStorageEnabled
    />
  );
});

export default MapCanvas;
