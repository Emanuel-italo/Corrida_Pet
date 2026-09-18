import { Platform } from 'react-native';

// Este arquivo existe só para o TypeScript resolver o tipo de "./petPhoto" nos imports.
// Em tempo de bundle, o Metro sempre prefere petPhoto.native.ts (iOS/Android) ou
// petPhoto.web.ts (Web) automaticamente, então o código abaixo nunca roda de fato.
const impl = Platform.OS === 'web' ? require('./petPhoto.web') : require('./petPhoto.native');

export const saveResizedPetPhoto: (sourceUri: string) => Promise<string> = impl.saveResizedPetPhoto;
export const readPetPhotoAsBase64: (uri: string) => Promise<string> = impl.readPetPhotoAsBase64;
