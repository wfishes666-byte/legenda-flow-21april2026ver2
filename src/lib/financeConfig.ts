// Helpers for outlet-specific Laporan Harian Finance configuration

export interface IncomeField {
  key: string;
  label: string;
  group?: string; // optional group code (A/B/C/D) for summary
}

/** Two parallel columns sharing a list of platforms (e.g. Penjualan vs Pendapatan Online Food). */
export interface PairGroup {
  key: string;
  left_label: string;
  right_label: string;
  left_prefix: string;   // e.g. "penjualan_online" -> field keys "penjualan_online_grabfood"
  right_prefix: string;  // e.g. "pendapatan_online"
  platforms: { key: string; label: string }[];
}

export interface SummaryGroup {
  code: string;
  label: string;
  fields?: string[];                    // income field keys to sum
  includes_expense?: boolean;           // sums expense (default: all)
  expense_type?: 'cash' | 'transfer' | 'all'; // restrict expense sum to a payment type
  expense_breakdown?: ('cash' | 'transfer')[]; // sub-rows under this group
  is_selisih?: boolean;                 // computed via selisih_formula
  hide_amount?: boolean;                // hide computed amount on the row (label-only header)
}

export interface OutletFinanceConfig {
  outlet_id: string;
  income_fields: IncomeField[];
  pair_groups?: PairGroup[];
  summary_groups: SummaryGroup[];
  selisih_formula: string;
  /** When set, shows a read-only inline field (in the income grid) displaying the selisih value. */
  selisih_inline_label?: string;
}

/**
 * Safely evaluate a selisih formula given a context of numeric vars.
 * Allowed: variable names (a-z, _), digits, +-*\/(), spaces.
 */
export function evalSelisih(formula: string, ctx: Record<string, number>): number {
  if (!formula) return 0;
  if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(formula)) return 0;
  try {
    const keys = Object.keys(ctx);
    const vals = keys.map((k) => ctx[k] || 0);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `return (${formula});`);
    const result = fn(...vals);
    return typeof result === 'number' && Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

export const DEFAULT_CONFIG: Omit<OutletFinanceConfig, 'outlet_id'> = {
  income_fields: [
    { key: 'cash_start', label: 'Cash on Hand Awal', group: 'A' },
    { key: 'cash_added', label: 'Tambahan Cash on Hand', group: 'A' },
  ],
  summary_groups: [
    { code: 'A', label: 'Cash on Hand', fields: ['cash_start', 'cash_added'] },
    { code: 'B', label: 'Pengeluaran', includes_expense: true, expense_breakdown: ['cash', 'transfer'] },
    { code: 'C', label: 'Sisa', is_selisih: true },
  ],
  selisih_formula: '(cash_start + cash_added) - total_cash_expense',
};
