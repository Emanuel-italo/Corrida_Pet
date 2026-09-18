const MAX_SIZE = 512;

export async function saveResizedPetPhoto(sourceUri: string): Promise<string> {
  const response = await fetch(sourceUri);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.8);
}

export async function readPetPhotoAsBase64(uri: string): Promise<string> {
  // No Web, a foto já é salva como data URI (veja saveResizedPetPhoto acima).
  return uri;
}
