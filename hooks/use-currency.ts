"use client";
import { useMemo } from "react";
import { useGymContext } from "@/contexts/gym-context";
import { formatMoney, formatMoneyCompact, currencySymbol } from "@/lib/money";

/**
 * Currency formatting bound to the active gym's country. Drop-in replacement for
 * the old `formatCurrency` import in client components:
 *
 *   const { format } = useCurrency();
 *   format(member.monthly_fee)   // "Rs. 5,000" for a PK gym, "$50.00" for US
 *
 * A gym with no country (or outside the dashboard provider) resolves to PK, so
 * this is a no-op for every existing Pakistani gym.
 */
export function useCurrency() {
  const { gym } = useGymContext();
  const country = gym?.country ?? null;
  return useMemo(
    () => ({
      country,
      symbol: currencySymbol(country),
      format: (amount: number) => formatMoney(amount, country),
      formatCompact: (amount: number) => formatMoneyCompact(amount, country),
    }),
    [country],
  );
}
