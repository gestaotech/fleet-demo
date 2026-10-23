/*
 * Regras de veiculos (portado de js/core/vehicles.js).
 *
 * Situacao cadastral (Ativo/Inativo) e informada pelo usuario.
 * Situacao operacional (Disponivel/Em manutencao) e derivada das manutencoes
 * abertas. A quilometragem atual e derivada do maior valor registrado em
 * abastecimentos, trocas de oleo e manutencoes - nao existe hodometro proprio.
 */
import type { DadosFrota, Veiculo } from "./types";

export const PLACA_PATTERN = /^(?:[A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/;

export function findVeiculo(data: DadosFrota, id: string): Veiculo | null {
  return data.veiculos.find((v) => v.id === id) ?? null;
}

export function isActive(vehicle: Veiculo | null | undefined): boolean {
  if (!vehicle) return false;
  return vehicle.situacao === "Ativo";
}

export function hasOpenMaintenance(data: DadosFrota, veiculoId: string): boolean {
  return data.manutencoes.some(
    (m) => m.veiculoId === veiculoId && m.status !== "Concluída",
  );
}

export function operationalStatus(data: DadosFrota, veiculoId: string): string {
  return hasOpenMaintenance(data, veiculoId) ? "Em manutenção" : "Disponível";
}

export function currentKm(data: DadosFrota, veiculoId: string): number | null {
  const valores: number[] = [];
  for (const a of data.abastecimentos ?? []) {
    if (a.veiculoId === veiculoId && Number.isInteger(a.quilometragem)) {
      valores.push(a.quilometragem);
    }
  }
  for (const t of data.trocasOleo ?? []) {
    if (t.veiculoId === veiculoId && Number.isInteger(t.quilometragem)) {
      valores.push(t.quilometragem);
    }
  }
  for (const m of data.manutencoes ?? []) {
    if (
      m.veiculoId === veiculoId &&
      typeof m.quilometragem === "number" &&
      Number.isInteger(m.quilometragem)
    ) {
      valores.push(m.quilometragem);
    }
  }
  return valores.length ? Math.max(...valores) : null;
}

export function vehicleSummary(data: DadosFrota) {
  const total = data.veiculos.length;
  const ativos = data.veiculos.filter((v) => v.situacao === "Ativo").length;
  return {
    total,
    ativos,
    inativos: total - ativos,
    emManutencao: data.veiculos.filter(
      (v) => operationalStatus(data, v.id) === "Em manutenção",
    ).length,
  };
}
