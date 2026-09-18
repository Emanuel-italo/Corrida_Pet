import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

const PET_PHOTO_FILENAME = 'pet-photo.jpg';

export async function saveResizedPetPhoto(sourceUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri);
  const rendered = await context.resize({ width: 512 }).renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  const destination = new File(Paths.document, PET_PHOTO_FILENAME);
  if (destination.exists) destination.delete();

  const renderedFile = new File(result.uri);
  await renderedFile.copy(destination);

  return destination.uri;
}

export async function readPetPhotoAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  const base64 = await file.base64();
  return `data:image/jpeg;base64,${base64}`;
}
