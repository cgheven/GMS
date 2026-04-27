"use client";
import { useGymContext } from "@/contexts/gym-context";

export function useGymData() {
  return useGymContext();
}
