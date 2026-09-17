import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import RunScreen from './src/screens/RunScreen';
import PetScreen from './src/screens/PetScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { usePetStore } from './src/store/usePetStore';
import { colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Corrida: '🏃',
  'Meu Pet': '🐾',
  Histórico: '📜',
};

export default function App() {
  const [hasHydrated, setHasHydrated] = useState(usePetStore.persist.hasHydrated());

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

  return (
    <SafeAreaProvider>
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
          <Tab.Screen name="Corrida" component={RunScreen} />
          <Tab.Screen name="Meu Pet" component={PetScreen} />
          <Tab.Screen name="Histórico" component={HistoryScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { fontSize: 18, color: colors.text },
});
