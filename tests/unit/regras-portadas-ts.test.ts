import { describe, it, expect } from "vitest";
import { availableMonths, monthRange, resolvePeriod } from "@/modules/vehicles/rules/period";
import { fuelConsumption, fuelSummary } from "@/modules/vehicles/rules/fuel";
import { oilStatusByVehicle } from "@/modules/vehicles/rules/oil";
import { inventory, balance } from "@/modules/vehicles/rules/warehouse";
import { vehicleCosts, fleetCosts } from "@/modules/vehicles/rules/costs";
import fixture from "../../tests/fixtures/legado-dataset.json";

describe("Regras portadas (TS) - equivalencia com demo aprovada", () => {
  it("meses e periodos", () => {
    expect(availableMonths(fixture as any)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-05",
      "2026-02",
    ]);
    expect(monthRange("2026-10")).toMatchObject({
      anoMes: "2026-10",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(resolvePeriod("")).toEqual({ from: "", to: "", anoMes: "" });
  });

  it("custos frota e por veiculo sem duplicidade", () => {
    const f = fixture as any;
    const all = fleetCosts(f);
    expect(all.total).toBe(10527);
    expect(all.combustivel.total).toBe(17235.9);
    expect(all.totalGeral).toBe(27762.9);

    const c10 = fleetCosts(f, resolvePeriod("2026-10"));
    expect(c10.total).toBe(3319);
    expect(c10.combustivel.total).toBe(3156.4);
    expect(c10.totalGeral).toBe(6475.4);

    const v3 = vehicleCosts(f, "VEI-003", resolvePeriod("2026-10"));
    expect(v3.total).toBe(3054);
    expect(v3.pecasAlmoxarifado).toBe(2924);
    expect(v3.trocasOleoProprias).toBe(0);
  });

  it("combustivel - consumo tanque cheio e resumo por periodo", () => {
    const f = fixture as any;
    const c2 = fuelConsumption(f, "VEI-002");
    expect(c2.suficiente).toBe(true);
    expect(c2.media).toBe(3.62);
    expect(c2.tanquesCheios).toBe(4);
    expect(c2.segmentos.length).toBe(3);

    const s10 = fuelSummary(f, { from: "2026-10-01", to: "2026-10-31" });
    expect(s10.registros).toBe(4);
    expect(s10.litros).toBe(521.5);
    expect(s10.precoMedio).toBe(6.053);
  });

  it("oleo - status sem duplicar custo do almoxarifado", () => {
    const f = fixture as any;
    const status = oilStatusByVehicle(f, { hoje: "2026-10-23" });
    const byId = Object.fromEntries(status.map((s) => [s.veiculoId, s]));
    expect(byId["VEI-001"]?.situacao).toBe("Próxima da troca");
    expect(byId["VEI-002"]?.situacao).toBe("Vencida por quilometragem");
    expect(byId["VEI-003"]?.situacao).toBe("Em dia");
    expect(byId["VEI-005"]?.situacao).toBe("Pendente de dados");
  });

  it("almoxarifado - saldo, historico estavel e estoque baixo", () => {
    const f = fixture as any;
    expect(balance(f, "PEC-001")).toBe(47);
    const inv = inventory(f);
    const p1 = inv.find((p) => p.id === "PEC-001");
    expect(p1?.saldo).toBe(47);
    expect(p1?.baixo).toBe(false);
    const p5 = inv.find((p) => p.id === "PEC-005");
    expect(p5?.baixo).toBe(true);
  });
});
