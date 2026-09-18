import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePetStore } from '../store/usePetStore';
import {
  currentNeedValue,
  ENERGY_DECAY_PER_HOUR,
  frameTierForLevel,
  HUNGER_DECAY_PER_HOUR,
  moodForNeeds,
  xpThresholdForLevel,
} from '../store/leveling';
import { formatDistance } from '../hex/format';
import { colors } from '../theme/colors';

export default function PetScreen() {
  const pet = usePetStore((state) => state.pet);
  const history = usePetStore((state) => state.history);
  const setPetName = usePetStore((state) => state.setPetName);
  const insets = useSafeAreaInsets();

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(pet.name);

  const totalDistanceMeters = useMemo(
    () => history.reduce((sum, run) => sum + run.distanceMeters, 0),
    [history]
  );

  const hunger = currentNeedValue(pet.hunger, pet.lastCareUpdate, HUNGER_DECAY_PER_HOUR);
  const energy = currentNeedValue(pet.energy, pet.lastCareUpdate, ENERGY_DECAY_PER_HOUR);
  const mood = moodForNeeds(hunger, energy);
  const frameTier = frameTierForLevel(pet.level);

  const xpThreshold = xpThresholdForLevel(pet.level);
  const xpProgress = Math.min(pet.xp / xpThreshold, 1);

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0) setPetName(trimmed);
    setIsEditingName(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.content}>
        <View style={[styles.avatarRing, { borderColor: frameTier.color }]}>
          {pet.photoUri && <Image source={{ uri: pet.photoUri }} style={styles.avatarImage} />}
          {frameTier.badge ? (
            <View style={[styles.tierBadge, { backgroundColor: frameTier.color }]}>
              <Text style={styles.tierBadgeText}>{frameTier.badge}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.tierLabel}>{frameTier.name}</Text>

        {isEditingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              maxLength={20}
              onSubmitEditing={saveName}
            />
            <TouchableOpacity style={styles.saveButton} onPress={saveName}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setIsEditingName(true)}>
            <Text style={styles.name}>{pet.name} ✏️</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.mood}>
          {mood.emoji} {mood.label}
        </Text>

        <Text style={styles.level}>Nível {pet.level}</Text>
        <View style={styles.xpBarBackground}>
          <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
        </View>
        <Text style={styles.xpLabel}>
          {pet.xp} / {xpThreshold} XP
        </Text>

        <View style={styles.needsSection}>
          <NeedBar label="🍖 Fome" value={hunger} color={colors.primary} />
          <NeedBar label="⚡ Energia" value={energy} color={colors.accent} />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Distância total" value={formatDistance(totalDistanceMeters)} />
          <StatCard label="Buscas realizadas" value={`${history.length}`} />
        </View>
      </View>
    </View>
  );
}

function NeedBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.needRow}>
      <Text style={styles.needLabel}>{label}</Text>
      <View style={styles.needBarBackground}>
        <View style={[styles.needBarFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 96,
  },
  content: { width: '100%', maxWidth: 480, alignItems: 'center' },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  avatarImage: { width: 130, height: 130, borderRadius: 65 },
  tierBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  tierBadgeText: { fontSize: 16 },
  tierLabel: { fontSize: 12, color: colors.textMuted, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 4 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 18,
    minWidth: 140,
    backgroundColor: colors.surface,
  },
  saveButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  mood: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  level: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
  xpBarBackground: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginTop: 8,
    overflow: 'hidden',
  },
  xpBarFill: { height: '100%', backgroundColor: colors.accent },
  xpLabel: { marginTop: 6, color: colors.textMuted, fontSize: 12 },
  needsSection: { width: '100%', marginTop: 20, gap: 10 },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  needLabel: { width: 90, fontSize: 13, color: colors.text },
  needBarBackground: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  needBarFill: { height: '100%' },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
