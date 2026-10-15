// Nigerian payroll deductions: PAYE (Nigeria Tax Act 2025, in force from 1 January 2026),
// pension (Pension Reform Act 2014) and National Housing Fund (NHF Act).
//
// Every rate here is a SETTING with a sensible default, not a hard-coded rule, because tax law
// changes and companies structure pay differently. Results are estimates until a qualified
// payroll professional confirms the settings in Membra (see PayrollConfig.confirmedBy).

export interface TaxBand {
  /** Upper limit of the band in naira of annual taxable income; null for "and above". */
  upTo: number | null;
  /** Percentage, e.g. 15 for 15%. */
  rate: number;
}

export interface PayrollConfig {
  /** Progressive annual bands applied to taxable income. */
  bands: TaxBand[];
  /** Rent relief: this % of annual rent paid… */
  rentReliefRate: number;
  /** …up to this many naira a year. */
  rentReliefCap: number;
  /** Employee pension contribution, % of basic + housing + transport. */
  pensionEmployeeRate: number;
  /** Employer pension contribution, % of basic + housing + transport (a cost to the company, not a deduction). */
  pensionEmployerRate: number;
  /** National Housing Fund, % of basic. */
  nhfEnabled: boolean;
  nhfRate: number;
  /** People earning the national minimum wage or less pay no PAYE. Monthly, in naira. */
  minimumWageMonthly: number;
  /** How monthly gross is split, in %. "Other" is whatever is left. */
  basicPct: number;
  housingPct: number;
  transportPct: number;
  /** Who confirmed these settings are right for this company (empty = not yet confirmed). */
  confirmedBy: string;
  confirmedAt: string | null;
}

export const NTA_2025_BANDS: TaxBand[] = [
  { upTo: 800_000, rate: 0 },
  { upTo: 3_000_000, rate: 15 },
  { upTo: 12_000_000, rate: 18 },
  { upTo: 25_000_000, rate: 21 },
  { upTo: 50_000_000, rate: 23 },
  { upTo: null, rate: 25 },
];

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  bands: NTA_2025_BANDS,
  rentReliefRate: 20,
  rentReliefCap: 500_000,
  pensionEmployeeRate: 8,
  pensionEmployerRate: 10,
  nhfEnabled: true,
  nhfRate: 2.5,
  minimumWageMonthly: 70_000,
  basicPct: 40,
  housingPct: 30,
  transportPct: 15,
  confirmedBy: "",
  confirmedAt: null,
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Fills gaps in a stored config with defaults, and ignores anything malformed. */
export function normaliseConfig(raw: unknown): PayrollConfig {
  const c = raw && typeof raw === "object" ? (raw as Partial<PayrollConfig>) : {};
  const pick = (k: keyof PayrollConfig, min: number, max: number) => {
    const v = c[k];
    return isNum(v) && v >= min && v <= max ? v : (DEFAULT_PAYROLL_CONFIG[k] as number);
  };
  const bands = Array.isArray(c.bands) && validBands(c.bands as TaxBand[]) ? (c.bands as TaxBand[]).map((b) => ({ upTo: b.upTo, rate: b.rate })) : NTA_2025_BANDS;
  return {
    bands,
    rentReliefRate: pick("rentReliefRate", 0, 100),
    rentReliefCap: pick("rentReliefCap", 0, 1e9),
    pensionEmployeeRate: pick("pensionEmployeeRate", 0, 100),
    pensionEmployerRate: pick("pensionEmployerRate", 0, 100),
    nhfEnabled: typeof c.nhfEnabled === "boolean" ? c.nhfEnabled : DEFAULT_PAYROLL_CONFIG.nhfEnabled,
    nhfRate: pick("nhfRate", 0, 100),
    minimumWageMonthly: pick("minimumWageMonthly", 0, 1e8),
    basicPct: pick("basicPct", 0, 100),
    housingPct: pick("housingPct", 0, 100),
    transportPct: pick("transportPct", 0, 100),
    confirmedBy: typeof c.confirmedBy === "string" ? c.confirmedBy.slice(0, 120) : "",
    confirmedAt: typeof c.confirmedAt === "string" ? c.confirmedAt : null,
  };
}

/** Bands must climb, end with an open band, and use rates between 0 and 100. */
export function validBands(bands: TaxBand[]): boolean {
  if (!bands.length || bands.length > 12) return false;
  let prev = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (!isNum(b.rate) || b.rate < 0 || b.rate > 100) return false;
    const last = i === bands.length - 1;
    if (last) {
      if (b.upTo !== null) return false;
    } else if (!isNum(b.upTo) || b.upTo <= prev) return false;
    if (!last) prev = b.upTo as number;
  }
  return true;
}

export function validConfig(c: PayrollConfig): boolean {
  return validBands(c.bands) && c.basicPct + c.housingPct + c.transportPct <= 100 && c.basicPct > 0;
}

/** Annual tax on annual taxable income using progressive bands. */
export function annualTax(taxable: number, bands: TaxBand[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of bands) {
    if (taxable <= lower) break;
    const upper = b.upTo ?? Infinity;
    tax += (Math.min(taxable, upper) - lower) * (b.rate / 100);
    lower = upper;
  }
  return round2(tax);
}

export interface Payslip {
  monthlyGross: number;
  basic: number;
  housing: number;
  transport: number;
  other: number;
  /** Monthly deductions */
  pension: number;
  nhf: number;
  paye: number;
  totalDeductions: number;
  net: number;
  /** Monthly employer cost on top of gross */
  employerPension: number;
  /** Annual figures used for PAYE */
  annualGross: number;
  annualRentRelief: number;
  annualTaxable: number;
  annualPaye: number;
  /** True when the person earns the minimum wage or less and pays no PAYE. */
  minimumWageExempt: boolean;
}

/** Works out one person's monthly payslip from monthly gross and annual rent paid. */
export function computePayslip(monthlyGross: number, annualRent: number, c: PayrollConfig): Payslip {
  const g = Math.max(0, monthlyGross || 0);
  const basic = round2((g * c.basicPct) / 100);
  const housing = round2((g * c.housingPct) / 100);
  const transport = round2((g * c.transportPct) / 100);
  const other = round2(g - basic - housing - transport);
  const pension = round2(((basic + housing + transport) * c.pensionEmployeeRate) / 100);
  const employerPension = round2(((basic + housing + transport) * c.pensionEmployerRate) / 100);
  const nhf = c.nhfEnabled ? round2((basic * c.nhfRate) / 100) : 0;

  const annualGross = g * 12;
  const annualRentRelief = round2(Math.min((Math.max(0, annualRent || 0) * c.rentReliefRate) / 100, c.rentReliefCap));
  const annualTaxable = round2(Math.max(0, annualGross - pension * 12 - nhf * 12 - annualRentRelief));
  const minimumWageExempt = g <= c.minimumWageMonthly;
  const annualPaye = minimumWageExempt ? 0 : annualTax(annualTaxable, c.bands);
  const paye = round2(annualPaye / 12);
  const totalDeductions = round2(pension + nhf + paye);
  return {
    monthlyGross: g,
    basic,
    housing,
    transport,
    other,
    pension,
    nhf,
    paye,
    totalDeductions,
    net: round2(g - totalDeductions),
    employerPension,
    annualGross,
    annualRentRelief,
    annualTaxable,
    annualPaye,
    minimumWageExempt,
  };
}

export function bandLabel(bands: TaxBand[], i: number): string {
  const from = i === 0 ? 0 : (bands[i - 1].upTo as number);
  const fmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  const b = bands[i];
  if (i === 0) return `First ${fmt(b.upTo as number)}`;
  return b.upTo === null ? `Above ${fmt(from)}` : `${fmt(from)} to ${fmt(b.upTo)}`;
}
