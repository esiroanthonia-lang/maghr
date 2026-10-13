// Unit tests for Nigerian PAYE, pension and NHF calculations. Run with: npm test
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { appReducer } from "../lib/app-reducer";
import { createDemoData } from "../lib/demo-data";
import { runTotals, type PeopleAction } from "../lib/people";
import { rolesFor } from "../lib/workspace";
import { annualTax, computePayslip, DEFAULT_PAYROLL_CONFIG, normaliseConfig, NTA_2025_BANDS, validBands, validConfig } from "../lib/paye";

const C = DEFAULT_PAYROLL_CONFIG;

describe("PAYE bands (Nigeria Tax Act 2025)", () => {
  it("matches published worked examples", () => {
    // Totals published in Adeola Oyinlade & Co's commentary on the Act (bands applied to the amount shown).
    const cases: [number, number][] = [
      [800_000, 0],
      [1_200_000, 60_000],
      [3_000_000, 330_000],
      [6_000_000, 870_000],
      [15_000_000, 2_580_000],
      [40_000_000, 8_130_000],
      [60_000_000, 12_930_000],
    ];
    for (const [income, tax] of cases) assert.equal(annualTax(income, NTA_2025_BANDS), tax, `tax on ${income}`);
  });

  it("validates custom bands", () => {
    assert.ok(validBands(NTA_2025_BANDS));
    assert.ok(!validBands([{ upTo: 100, rate: 0 }]), "must end open");
    assert.ok(!validBands([{ upTo: 500, rate: 0 }, { upTo: 400, rate: 10 }, { upTo: null, rate: 20 }]), "must climb");
    assert.ok(!validBands([{ upTo: null, rate: 120 }]));
  });
});

describe("payslip", () => {
  it("works out pension, NHF, rent relief, PAYE and net for a ₦500,000 monthly salary", () => {
    const p = computePayslip(500_000, 1_800_000, C);
    // Split 40/30/15/15
    assert.deepEqual([p.basic, p.housing, p.transport, p.other], [200_000, 150_000, 75_000, 75_000]);
    assert.equal(p.pension, 34_000); // 8% of 425,000
    assert.equal(p.employerPension, 42_500); // 10% of 425,000
    assert.equal(p.nhf, 5_000); // 2.5% of basic
    assert.equal(p.annualRentRelief, 360_000); // 20% of 1.8m, under the 500k cap
    // Taxable = 6,000,000 − 408,000 − 60,000 − 360,000 = 5,172,000
    assert.equal(p.annualTaxable, 5_172_000);
    // 0 + 2.2m×15% (330,000) + 2,172,000×18% (390,960) = 720,960
    assert.equal(p.annualPaye, 720_960);
    assert.equal(p.paye, 60_080);
    assert.equal(p.net, 500_000 - 34_000 - 5_000 - 60_080);
  });

  it("caps rent relief at ₦500,000", () => {
    assert.equal(computePayslip(1_000_000, 6_000_000, C).annualRentRelief, 500_000);
    assert.equal(computePayslip(1_000_000, 0, C).annualRentRelief, 0);
  });

  it("exempts minimum-wage earners from PAYE but still deducts pension", () => {
    const p = computePayslip(70_000, 0, C);
    assert.equal(p.paye, 0);
    assert.ok(p.minimumWageExempt);
    assert.ok(p.pension > 0);
  });

  it("charges no PAYE when taxable income is within the first ₦800,000", () => {
    const p = computePayslip(72_000, 0, C); // taxable ₦796,608 after pension and NHF
    assert.equal(p.minimumWageExempt, false);
    assert.equal(p.paye, 0);
  });

  it("can switch NHF off", () => {
    assert.equal(computePayslip(300_000, 0, { ...C, nhfEnabled: false }).nhf, 0);
  });

  it("net always equals gross minus deductions", () => {
    for (const g of [0, 70_000, 123_456.78, 380_000, 2_500_000, 9_999_999]) {
      const p = computePayslip(g, 1_000_000, C);
      assert.ok(Math.abs(p.monthlyGross - p.pension - p.nhf - p.paye - p.net) < 0.005, `gross ${g}`);
      assert.ok(p.net >= 0);
    }
  });
});

describe("payroll settings", () => {
  it("fills missing or broken settings with defaults", () => {
    assert.deepEqual(normaliseConfig({}), C);
    assert.deepEqual(normaliseConfig(null), C);
    const n = normaliseConfig({ pensionEmployeeRate: 10, nhfRate: "x", bands: [{ upTo: 5, rate: 0 }] });
    assert.equal(n.pensionEmployeeRate, 10);
    assert.equal(n.nhfRate, 2.5);
    assert.deepEqual(n.bands, NTA_2025_BANDS);
  });

  it("rejects a pay split over 100%", () => {
    assert.ok(validConfig(C));
    assert.ok(!validConfig({ ...C, basicPct: 60, housingPct: 30, transportPct: 20 }));
  });
});


describe("payroll runs with deductions", () => {
  const NOW = new Date("2026-10-12T13:00:00Z");
  const at = NOW.toISOString();
  const run = (s: ReturnType<typeof createDemoData>, a: PeopleAction) => appReducer(s, a);

  it("seeds approved runs with payslips whose totals match", () => {
    const s = createDemoData(NOW);
    for (const r of s.payrollRuns) {
      const lines = s.payrollLines.filter((l) => l.runId === r.id);
      assert.equal(lines.length, r.employeeCount);
      assert.deepEqual(runTotals(lines), { payeTotal: r.payeTotal, pensionTotal: r.pensionTotal, nhfTotal: r.nhfTotal, netTotal: r.netTotal, employerPensionTotal: r.employerPensionTotal });
    }
  });

  it("creates payslips on submit and clears them when returned to draft", () => {
    let s = createDemoData(NOW);
    s = run(s, { type: "payroll/create", period: "2026-11", id: "r1", at, by: "Ada" });
    assert.equal(s.payrollLines.filter((l) => l.runId === "r1").length, 0);
    s = run(s, { type: "payroll/submit", runId: "r1", id: "s1", at, by: "Ada" });
    const lines = s.payrollLines.filter((l) => l.runId === "r1");
    const r = s.payrollRuns.find((x) => x.id === "r1")!;
    assert.equal(lines.length, r.employeeCount);
    assert.ok(r.payeTotal > 0 && r.netTotal < r.grossTotal);
    const one = lines[0];
    const expect = computePayslip(s.pay[one.employeeId], s.rent[one.employeeId] ?? 0, s.payrollConfig);
    assert.equal(one.paye, expect.paye);
    assert.equal(one.net, expect.net);
    s = run(s, { type: "payroll/reopen", runId: "r1", id: "o1", at });
    assert.equal(s.payrollLines.filter((l) => l.runId === "r1").length, 0);
  });

  it("uses declared rent to reduce PAYE", () => {
    let s = createDemoData(NOW);
    const e = s.employees.find((x) => x.status === "Active" && s.pay[x.id] > 400_000 && !s.rent[x.id])!;
    const before = computePayslip(s.pay[e.id], 0, s.payrollConfig).paye;
    s = run(s, { type: "employee/setRent", employeeId: e.id, annualRent: 2_000_000, id: "x", at });
    assert.equal(s.rent[e.id], 2_000_000);
    assert.ok(computePayslip(s.pay[e.id], s.rent[e.id], s.payrollConfig).paye < before);
    assert.equal(run(s, { type: "employee/setRent", employeeId: e.id, annualRent: -1, id: "y", at }), s);
  });

  it("records who confirmed the rules, and clears it when rules change", () => {
    let s = createDemoData(NOW);
    s = run(s, { type: "settings/payroll", config: s.payrollConfig, confirm: true, id: "c1", at, by: "Ada (ACA)" });
    assert.equal(s.payrollConfig.confirmedBy, "Ada (ACA)");
    s = run(s, { type: "settings/payroll", config: s.payrollConfig, confirm: false, id: "c2", at, by: "Bola" });
    assert.equal(s.payrollConfig.confirmedBy, "Ada (ACA)", "saving unchanged rules keeps the confirmation");
    s = run(s, { type: "settings/payroll", config: { ...s.payrollConfig, nhfEnabled: false }, confirm: false, id: "c3", at, by: "Bola" });
    assert.equal(s.payrollConfig.confirmedBy, "");
    assert.equal(run(s, { type: "settings/payroll", config: { ...s.payrollConfig, basicPct: 90, housingPct: 20 }, confirm: true, id: "c4", at }), s);
  });

  it("only HR admins change rent or payroll rules", () => {
    assert.deepEqual(rolesFor("employee/setRent"), ["hr_admin"]);
    assert.deepEqual(rolesFor("settings/payroll"), ["hr_admin"]);
  });
});
