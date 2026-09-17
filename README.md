# Corrida Pet 🐾

Jogo de corrida/caminhada com conquista de território para donos de cachorro — inspirado em INTVL, Run an Empire e Stride. Você sai para correr ou caminhar com o GPS ligado e vai "pintando" hexágonos no mapa real conforme percorre as ruas, conquistando território para o seu pet.

## Status atual (MVP)

- App **React Native (Expo) + TypeScript**.
- **Single-player local**: sem backend, sem contas, sem disputa entre jogadores ainda.
- Território dividido em **hexágonos H3** (resolução 10, ~15.000 m² cada, escala de quarteirão).
- Progresso salvo localmente no dispositivo (AsyncStorage).

### Telas

- **Corrida**: mapa em tempo real, botão de iniciar/finalizar, distância/tempo/hexágonos capturados na corrida atual.
- **Meu Pet**: nome do pet (editável), nível, barra de XP, total de território, distância e corridas.
- **Histórico**: lista das corridas anteriores com métricas de cada uma.

### Como funciona a captura de território

1. Ao iniciar a corrida, o app pede permissão de localização e começa a rastrear sua posição (`expo-location`).
2. Cada ponto de GPS é convertido no hexágono H3 correspondente (`h3-js`).
3. Hexágonos novos aparecem em laranja no mapa durante a corrida; território já conquistado aparece em verde.
4. Ao finalizar, os hexágonos novos são somados ao território permanente do pet e você ganha XP (por hexágono novo + por distância percorrida). XP suficiente sobe o nível do pet.

## Rodando o projeto

```bash
npm install
npm run start
```

Abra no celular com o app **Expo Go** (escaneando o QR code) ou em um emulador Android/simulador iOS.

### Importante sobre mapas e GPS

- `react-native-maps` usa Apple Maps no iOS e Google Maps no Android. Para **build de produção/EAS** no Android é necessário configurar uma API key do Google Maps em `app.json` (`android.config.googleMaps.apiKey`) — não incluída neste MVP.
- Teste a corrida ao ar livre ou com localização simulada no emulador — dentro de casa o GPS pode não ter sinal suficiente para gerar movimento no mapa.

## Estrutura do código

```
src/
  types/        tipos compartilhados (RunSummary, PetState, LatLng)
  hex/          conversão GPS -> hexágono H3, distância (haversine), formatação
  store/        estado global (Zustand) com persistência: pet, território, histórico, XP/nível
  screens/      RunScreen, PetScreen, HistoryScreen
  theme/        paleta de cores
App.tsx         navegação por abas + hidratação do estado persistido
```

## Próximos passos possíveis

- Multiplayer: sincronizar território com um backend e permitir disputa entre jogadores por hexágono.
- Exigir "fechar volta" (loop) para capturar território, como no Run an Empire, em vez de capturar por onde passa.
- Otimizar renderização do mapa para territórios grandes (culling por viewport).
- Rastreamento em segundo plano (permissão de localização "always") para não precisar manter o app aberto.
- Avatar do pet com acessórios/skins desbloqueáveis por nível.
