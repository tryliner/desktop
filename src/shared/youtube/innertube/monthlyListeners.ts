const VERIFIED_MONTHLY_LISTENERS_THRESHOLD = 50_000;

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  thousands: 1_000,
  тыс: 1_000,
  m: 1_000_000,
  million: 1_000_000,
  millions: 1_000_000,
  mln: 1_000_000,
  млн: 1_000_000,
  b: 1_000_000_000,
  billion: 1_000_000_000,
  billions: 1_000_000_000,
  bln: 1_000_000_000,
  млрд: 1_000_000_000,
};

function parseAmount(raw: string): number {
  const compact = raw.replace(/[\s  ]/g, "");
  const hasDot = compact.includes(".");
  const hasComma = compact.includes(",");
  if (hasDot && hasComma) {
    const decimal =
      compact.lastIndexOf(".") > compact.lastIndexOf(",") ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    return Number.parseFloat(
      compact.split(thousands).join("").replace(decimal, "."),
    );
  }
  if (hasComma) {
    return /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)
      ? Number.parseFloat(compact.replace(/,/g, ""))
      : Number.parseFloat(compact.replace(/,/g, "."));
  }
  if (hasDot) {
    return /^\d{1,3}(\.\d{3})+$/.test(compact)
      ? Number.parseInt(compact.replace(/\./g, ""), 10)
      : Number.parseFloat(compact);
  }
  return Number.parseInt(compact, 10);
}

export function parseMonthlyListenersCount(value?: string): number | undefined {
  if (!value) return undefined;
  const attached = value.match(/(\d[\d.,]*)([KMBkmb])\b/);
  const worded = value.match(
    /([\d.,\s  ]+)\s+(millions?|billions?|thousands?|млрд|млн|тыс|mln|bln)(?=\s|$|[.,])/i,
  );
  const plain = value.match(/([\d.,\s  ]+)/);
  const match = attached ?? worded ?? plain;
  if (!match) return undefined;
  const rawNumber = (match[1] ?? "").trim();
  const rawSuffix = (match[2] ?? "").trim().toLowerCase();
  if (!rawNumber || !/\d/.test(rawNumber)) return undefined;
  const amount = parseAmount(rawNumber);
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(amount * (rawSuffix ? (MULTIPLIERS[rawSuffix] ?? 1) : 1));
}

export function isVerifiedArtist(monthlyListeners?: string): boolean {
  const count = parseMonthlyListenersCount(monthlyListeners);
  return count !== undefined && count >= VERIFIED_MONTHLY_LISTENERS_THRESHOLD;
}
