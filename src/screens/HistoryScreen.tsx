import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePetStore } from '../store/usePetStore';
import { formatDate, formatDistance, formatDuration } from '../hex/format';
import { colors } from '../theme/colors';
import type { RunSummary } from '../types';

export default function HistoryScreen() {
  const history = usePetStore((state) => state.history);
  const insets = useSafeAreaInsets();

  if (history.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.emptyText}>Nenhuma busca ainda. Toque em "Localizar meu pet" para começar! 🐾</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listWrapper}>
        <FlatList
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16 }]}
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryItem run={item} />}
        />
      </View>
    </View>
  );
}

function HistoryItem({ run }: { run: RunSummary }) {
  return (
    <View style={styles.item}>
      <Text style={styles.date}>{formatDate(run.startedAt)}</Text>
      <View style={styles.row}>
        <Metric label="Distância" value={formatDistance(run.distanceMeters)} />
        <Metric label="Tempo" value={formatDuration(run.durationSeconds)} />
        <Metric label="XP" value={`+${run.xpGained}`} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  listWrapper: { width: '100%', maxWidth: 480, flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 96, gap: 12 },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingBottom: 96,
  },
  emptyText: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
  item: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  row: { flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  metricLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
