"use client";
import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Gym } from "@/types";

interface GymContextValue {
  profile: Profile | null;
  gym: Gym | null;
  gyms: Gym[];
  gymId: string | null;
  isDemo: boolean;
  setActiveGym: (gymId: string) => void;
}

const GymContext = createContext<GymContextValue>({
  profile: null,
  gym: null,
  gyms: [],
  gymId: null,
  isDemo: false,
  setActiveGym: () => {},
});

export function GymProvider({
  children,
  profile,
  gym,
  gyms,
  isDemo = false,
}: {
  children: React.ReactNode;
  profile: Profile | null;
  gym: Gym | null;
  gyms: Gym[];
  isDemo?: boolean;
}) {
  const router = useRouter();

  const setActiveGym = useCallback(
    (gymId: string) => {
      document.cookie = `pulse_active_gym=${gymId}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({ profile, gym, gyms, gymId: gym?.id ?? null, isDemo, setActiveGym }),
    [profile, gym, gyms, isDemo, setActiveGym]
  );

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGymContext() {
  return useContext(GymContext);
}
