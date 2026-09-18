import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PetState, RunSummary } from '../types';
import { applyXp, XP_PER_KM, XP_PER_NEW_HEX } from './leveling';

interface CompleteRunInput {
  hexIds: string[];
  distanceMeters: number;
  durationSeconds: number;
}

interface PetStore {
  pet: PetState;
  territory: string[];
  history: RunSummary[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setPetName: (name: string) => void;
  setPetPhoto: (uri: string) => void;
  completeRun: (input: CompleteRunInput) => RunSummary;
  resetProgress: () => void;
}

const initialPet: PetState = {
  name: 'Rex',
  photoUri: null,
  level: 1,
  xp: 0,
  hunger: 100,
  energy: 100,
  lastCareUpdate: Date.now(),
};

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      pet: initialPet,
      territory: [],
      history: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setPetName: (name) => set((state) => ({ pet: { ...state.pet, name } })),
      setPetPhoto: (uri) => set((state) => ({ pet: { ...state.pet, photoUri: uri } })),
      completeRun: ({ hexIds, distanceMeters, durationSeconds }) => {
        const state = get();
        const territorySet = new Set(state.territory);
        const newHexIds = hexIds.filter((id) => !territorySet.has(id));
        const xpGained = newHexIds.length * XP_PER_NEW_HEX + Math.round((distanceMeters / 1000) * XP_PER_KM);
        const { level, xp } = applyXp(state.pet.level, state.pet.xp, xpGained);

        const distanceKm = distanceMeters / 1000;
        const hunger = Math.min(100, state.pet.hunger + 10 + distanceKm * 5);
        const energy = Math.min(100, state.pet.energy + 15 + distanceKm * 5);

        const summary: RunSummary = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          startedAt: Date.now() - durationSeconds * 1000,
          endedAt: Date.now(),
          distanceMeters,
          durationSeconds,
          hexIds,
          newHexCount: newHexIds.length,
          xpGained,
        };

        set({
          territory: [...state.territory, ...newHexIds],
          pet: { ...state.pet, level, xp, hunger, energy, lastCareUpdate: Date.now() },
          history: [summary, ...state.history],
        });

        return summary;
      },
      resetProgress: () => set({ pet: initialPet, territory: [], history: [] }),
    }),
    {
      name: 'corrida-pet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PetStore>;
        return {
          ...currentState,
          ...persisted,
          pet: { ...currentState.pet, ...persisted.pet },
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
