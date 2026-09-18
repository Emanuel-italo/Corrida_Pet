import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePetStore } from '../store/usePetStore';
import { saveResizedPetPhoto } from '../media/petPhoto';
import { colors } from '../theme/colors';

export default function OnboardingScreen() {
  const setPetName = usePetStore((state) => state.setPetName);
  const setPetPhoto = usePetStore((state) => state.setPetPhoto);

  const [name, setName] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos da câmera para tirar a foto do seu pet.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!result.canceled) setPreviewUri(result.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar suas fotos para escolher a foto do seu pet.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) setPreviewUri(result.assets[0].uri);
  };

  const handleStart = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      Alert.alert('Falta o nome', 'Dê um nome para o seu pet.');
      return;
    }
    if (!previewUri) {
      Alert.alert('Falta a foto', 'Tire ou escolha uma foto do seu pet.');
      return;
    }

    setIsSaving(true);
    try {
      const savedUri = await saveResizedPetPhoto(previewUri);
      setPetName(trimmedName);
      setPetPhoto(savedUri);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a foto. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vamos conhecer seu pet! 🐾</Text>

      <TouchableOpacity style={styles.photoCircle} onPress={pickFromLibrary}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoPlaceholder}>Adicionar{'\n'}foto</Text>
        )}
      </TouchableOpacity>

      <View style={styles.photoButtonsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={pickFromCamera}>
          <Text style={styles.secondaryButtonText}>📷 Tirar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={pickFromLibrary}>
          <Text style={styles.secondaryButtonText}>🖼️ Galeria</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Nome do seu pet"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        maxLength={20}
      />

      <TouchableOpacity style={styles.startButton} onPress={handleStart} disabled={isSaving}>
        <Text style={styles.startButtonText}>{isSaving ? 'Salvando...' : 'Começar!'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 24, textAlign: 'center' },
  photoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  photoButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  nameInput: {
    width: '100%',
    marginTop: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  startButton: {
    width: '100%',
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
