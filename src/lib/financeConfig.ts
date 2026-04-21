// Helpers for outlet-specific Laporan Harian Finance configuration

export interface IncomeField {
  key: string;
  label: string;
  group?: string; // optional group code (A/B/C/D) for summary
}

export interface SummaryGroup {
  code: string;
  label: string;
  fields?: string[];                    // income field keys to sum
  includes_expense?: boolean;           // sums total expense
  expense_breakdown?: ('cash' | 'transfer')[]; // sub-rows under this group
  is_selisih?: boolean;                 // computed via selisih_formula
}

export interface OutletFinanceConfig {
  outlet_id: string;
  income_fields: IncomeField[];
  summary_groups: SummaryGroup[];
  selisih_formula: string;
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
