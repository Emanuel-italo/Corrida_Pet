import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usePetStore } from '../store/usePetStore';
import { petStageForLevel, xpThresholdForLevel } from '../store/leveling';
import { formatDistance } from '../hex/format';
import { colors } from '../theme/colors';

export default function PetScreen() {
  const pet = usePetStore((state) => state.pet);
  const territory = usePetStore((state) => state.territory);
  const history = usePetStore((state) => state.history);
  const setPetName = usePetStore((state) => state.setPetName);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(pet.name);

  const totalDistanceMeters = useMemo(
    () => history.reduce((sum, run) => sum + run.distanceMeters, 0),
    [history]
  );

  const xpThreshold = xpThresholdForLevel(pet.level);
  const xpProgress = Math.min(pet.xp / xpThreshold, 1);

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0) setPetName(trimmed);
    setIsEditingName(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{petStageForLevel(pet.level)}</Text>

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

      <Text style={styles.level}>Nível {pet.level}</Text>

      <View style={styles.xpBarBackground}>
        <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
      </View>
      <Text style={styles.xpLabel}>
        {pet.xp} / {xpThreshold} XP
      </Text>

      <View style={styles.statsGrid}>
        <StatCard label="Território" value={`${territory.length} hex`} />
        <StatCard label="Distância total" value={formatDistance(totalDistanceMeters)} />
        <StatCard label="Corridas" value={`${history.length}`} />
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
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', paddingTop: 32, paddingHorizontal: 20 },
  emoji: { fontSize: 96 },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 8 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
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
  level: { fontSize: 16, color: colors.textMuted, marginTop: 4 },
  xpBarBackground: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginTop: 20,
    overflow: 'hidden',
  },
  xpBarFill: { height: '100%', backgroundColor: colors.accent },
  xpLabel: { marginTop: 6, color: colors.textMuted, fontSize: 12 },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
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
