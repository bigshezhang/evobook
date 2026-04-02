import { create } from 'zustand';

export interface OnboardingFinishData {
  topic: string;
  level: string;
  verifiedConcept: string;
  focus: string;
  source: string;
  mode: string;
  intent: string;
}

interface OnboardingStore {
  finishData: OnboardingFinishData | null;
  setFinishData: (data: OnboardingFinishData) => void;
  clear: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  finishData: null,
  setFinishData: (data) => set({ finishData: data }),
  clear: () => set({ finishData: null }),
}));
