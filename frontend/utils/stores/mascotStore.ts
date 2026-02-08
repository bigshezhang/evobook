/**
 * Zustand store for mascot character and outfit state.
 *
 * Replaces direct localStorage reads/writes in mascotUtils.ts.
 * Uses persist middleware to automatically sync with localStorage.
 * Dispatches CustomEvents so non-React code (e.g. Mascot component listeners)
 * stays in sync.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MascotCharacter, MascotOutfit } from '../mascotConfig';
import { STORAGE_KEYS } from '../constants';

// ── Types ──────────────────────────────────────────────

interface MascotState {
  /** Currently selected mascot character */
  character: MascotCharacter;
  /** Currently equipped outfit */
  outfit: MascotOutfit;
}

interface MascotActions {
  /** Set the mascot character and dispatch a change event */
  setCharacter: (character: MascotCharacter) => void;
  /** Set the mascot outfit and dispatch a change event */
  setOutfit: (outfit: MascotOutfit) => void;
  /** Reset mascot state to defaults */
  reset: () => void;
}

type MascotStore = MascotState & MascotActions;

// ── Defaults ───────────────────────────────────────────

const DEFAULT_CHARACTER: MascotCharacter = 'oliver';
const DEFAULT_OUTFIT: MascotOutfit = 'default';

// ── Store ──────────────────────────────────────────────

export const useMascotStore = create<MascotStore>()(
  persist(
    (set) => ({
      // State
      character: DEFAULT_CHARACTER,
      outfit: DEFAULT_OUTFIT,

      // Actions
      setCharacter: (character: MascotCharacter) => {
        set({ character });
        // Dispatch event for backward-compatible listeners (e.g. Mascot component)
        window.dispatchEvent(
          new CustomEvent('mascot-character-changed', { detail: character }),
        );
      },

      setOutfit: (outfit: MascotOutfit) => {
        set({ outfit });
        // Dispatch event for backward-compatible listeners
        window.dispatchEvent(
          new CustomEvent('mascot-outfit-changed', { detail: outfit }),
        );
      },

      reset: () => {
        set({ character: DEFAULT_CHARACTER, outfit: DEFAULT_OUTFIT });
      },
    }),
    {
      name: 'evo-mascot-store',
      // Migrate legacy localStorage keys into the store on first load
      onRehydrateStorage: () => {
        return (_state, _error) => {
          // If legacy keys exist and store is fresh, migrate them
          const legacyCharacter = localStorage.getItem(STORAGE_KEYS.USER_MASCOT);
          const legacyOutfit = localStorage.getItem(STORAGE_KEYS.USER_OUTFIT);

          if (legacyCharacter || legacyOutfit) {
            const store = useMascotStore.getState();
            if (legacyCharacter) {
              store.setCharacter(legacyCharacter as MascotCharacter);
            }
            if (legacyOutfit) {
              store.setOutfit(legacyOutfit as MascotOutfit);
            }
            // Remove legacy keys after migration
            localStorage.removeItem(STORAGE_KEYS.USER_MASCOT);
            localStorage.removeItem(STORAGE_KEYS.USER_OUTFIT);
          }
        };
      },
    },
  ),
);
