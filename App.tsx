import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Buscar: 'locate',
  'Meu Pet': 'paw',
  Histórico: 'time',
};

// Largura máxima do conteúdo em telas largas (desktop web), para os painéis
// flutuantes não esticarem de ponta a ponta. No celular isso não tem efeito
// (a tela já é mais estreita que esse valor).
const CHROME_MAX_WIDTH = 480;

// No app nativo (ou dentro de um navegador de celular) a tela já é do tamanho de um celular,
// então o "frame" não faz diferença. Só em navegador de desktop essa moldura existia — e
// atrapalhava o teste, então o app agora ocupa a janela inteira no web.
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
              headerShown: false,
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarShowLabel: true,
              tabBarLabel: route.name,
              tabBarLabelStyle: styles.tabBarLabel,
              tabBarStyle: styles.tabBar,
              tabBarItemStyle: styles.tabBarItem,
              tabBarIcon: ({ focused, color }) => (
                <View style={[styles.tabIconWrapper, focused && styles.tabIconWrapperActive]}>
                  <Ionicons name={TAB_ICONS[route.name]} size={20} color={color} />
                </View>
              ),
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
  shell: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? colors.background : '#2B2622',
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? undefined : 440,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { fontSize: 18, color: colors.text },
  tabBar: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 14,
    width: '92%',
    maxWidth: CHROME_MAX_WIDTH,
    height: 66,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  tabBarItem: { paddingTop: 2 },
  tabBarLabel: { fontSize: 11, fontWeight: '700' },
  tabIconWrapper: {
    width: 40,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapperActive: {
    backgroundColor: `${colors.primary}22`,
  },
});
