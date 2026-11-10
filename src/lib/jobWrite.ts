// jobWrite.ts — save a job even when the database is missing a newer column.
//
// BUG FIX (owner report) — saving a work order failed with "Could not find
// the 'isNightJob' column of 'jobs' in the schema cache": the app sent a
// column no migration had added yet, and PostgREST rejects the whole write.
// This drops each column the database says it doesn't have and tries again,
// so the rest of the job still saves. onDropped lists what was left out so
// the caller can say which database update is still to run.
export async function tolerantJobWrite(
  row: Record<string, any>,
  run: (row: Record<string, any>) => PromiseLike<any>,
  onDropped?: (cols: string[]) => void,
): Promise<any> {
  let cur: Record<string, any> = { ...row };
  const dropped: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = await run(cur);
    const msg = String(r?.error?.message || "");
    const m = msg.match(/Could not find the '([^']+)' column/) || msg.match(/column "?([A-Za-z_]+)"? of relation/);
    if (r?.error && m && m[1] in cur) {
      const { [m[1]]: _gone, ...rest } = cur;
      cur = rest;
      dropped.push(m[1]);
      continue;
    }
    if (dropped.length && !r?.error) onDropped?.(dropped);
    return r;
  }
  return { error: { message: "Too many columns missing from the jobs table" } };
}

// Sales tax on a job: `amount` is what the customer pays (tax included) and
// `tax` is the tax part of it. Old jobs have no tax, so subtotal = amount.
export function jobTaxSplit(job: any): { subtotal: number; tax: number; total: number } {
  const total = Number(job?.amount) || 0;
  const tax = Math.max(0, Math.min(total, Number(job?.tax) || 0));
  return { subtotal: Math.round((total - tax) * 100) / 100, tax, total };
}

export const taxOf = (subtotal: number, rate: number) => Math.round((Number(subtotal) || 0) * (Number(rate) || 0)) / 100;
