import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RunScreen from './src/screens/RunScreen';
import PetScreen from './src/screens/PetScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { usePetStore } from './src/store/usePetStore';
import { colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Buscar: '📡',
  'Meu Pet': '🐾',
  Histórico: '📜',
};

// Mantém o app com largura de celular mesmo em telas grandes (navegador/tablet).
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.shell}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

export default function App() {
  const [hasHydrated, setHasHydrated] = useState(usePetStore.persist.hasHydrated());
  const photoUri = usePetStore((state) => state.pet.photoUri);

  useEffect(() => {
    const unsubscribe = usePetStore.persist.onFinishHydration(() => setHasHydrated(true));
    if (usePetStore.persist.hasHydrated()) setHasHydrated(true);
    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Carregando... 🐾</Text>
      </View>
    );
  }

  if (!photoUri) {
    return (
      <SafeAreaProvider>
        <AppShell>
          <OnboardingScreen />
        </AppShell>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppShell>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text },
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>,
            })}
          >
            <Tab.Screen name="Buscar" component={RunScreen} />
            <Tab.Screen name="Meu Pet" component={PetScreen} />
            <Tab.Screen name="Histórico" component={HistoryScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </AppShell>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#2B2622', alignItems: 'center' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { fontSize: 18, color: colors.text },
});
