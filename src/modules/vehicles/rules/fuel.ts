/*
 * Regras de combustivel (portado de js/core/fuel.js).
 *
 * - O preco por litro e derivado de valor total / litros (ou o total e derivado
 *   do preco), com tolerancia de R$ 0,10 para evitar divergencia silenciosa.
 * - Consumo: metodo de tanque cheio. A distancia entre dois tanques cheios e
 *   dividida por todos os litros abastecidos no intervalo, inclusive o ultimo.
 */
import { round2, round3, inPeriod } from "./shared";
import type { Abastecimento, DadosFrota } from "./types";

export const TOLERANCIA_VALOR = 0.1;

export type FiltroCombustivel = {
  veiculoId?: string;
  from?: string;
  to?: string;
};

export function listFuel(data: DadosFrota, filters: FiltroCombustivel = {}) {
  return data.abastecimentos
    .filter(
      (a) =>
        !filters.veiculoId ||
        filters.veiculoId === "Todos" ||
        a.veiculoId === filters.veiculoId,
    )
    .filter((a) => inPeriod(a.dataHora, filters.from, filters.to))
    .map((a) => {
      const veiculo = data.veiculos.find((v) => v.id === a.veiculoId);
      return { ...a, veiculoPlaca: veiculo ? veiculo.placa : a.veiculoId };
    })
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
}

export function fuelSummary(data: DadosFrota, filters: FiltroCombustivel = {}) {
  const rows = listFuel(data, filters);
  const valor = rows.reduce((acc, r) => acc + Number(r.valorTotal || 0), 0);
  const valorArredondado = Math.round((valor + Number.EPSILON) * 100) / 100;
  const litros = Math.round(rows.reduce((acc, r) => acc + r.litros, 0) * 1000) / 1000;
  return {
    registros: rows.length,
    valor: valorArredondado,
    litros,
    precoMedio: litros > 0 ? Math.round((valorArredondado / litros) * 1000) / 1000 : null,
  };
}

export type IntervaloConsumo = {
  deId: string;
  ateId: string;
  distancia: number;
  litros: number;
  media: number;
};

export function fuelConsumption(data: DadosFrota, veiculoId: string) {
  const registros = data.abastecimentos
    .map((registro, index) => ({ registro, index }))
    .filter((item) => item.registro.veiculoId === veiculoId)
    .sort(
      (a, b) =>
        a.registro.dataHora.localeCompare(b.registro.dataHora) || a.index - b.index,
    )
    .map((item) => item.registro);

  const tanques = registros.filter(
    (r) => r.tanqueCheio === true && Number.isInteger(r.quilometragem),
  );

  const segmentos: IntervaloConsumo[] = [];
  let ignorados = 0;
  let distanciaTotal = 0;
  let litrosTotal = 0;

  for (let i = 1; i < tanques.length; i += 1) {
    const anterior = tanques[i - 1];
    const atual = tanques[i];
    if (!anterior || !atual) continue;
    const distancia = atual.quilometragem - anterior.quilometragem;
    const posAnterior = registros.indexOf(anterior);
    const posAtual = registros.indexOf(atual);
    const litros = registros
      .slice(posAnterior + 1, posAtual + 1)
      .reduce((acc, r) => acc + r.litros, 0);

    if (distancia <= 0 || litros <= 0) {
      ignorados += 1;
      continue;
    }
    distanciaTotal += distancia;
    litrosTotal += litros;
    segmentos.push({
      deId: anterior.id,
      ateId: atual.id,
      distancia,
      litros: round3(litros),
      media: round2(distancia / litros),
    });
  }

  return {
    suficiente: segmentos.length > 0,
    media: segmentos.length ? round2(distanciaTotal / litrosTotal) : null,
    distancia: distanciaTotal,
    litros: round3(litrosTotal),
    segmentos,
    ignorados,
    tanquesCheios: tanques.length,
  };
}

/**
 * Normaliza valor informado x preco por litro.
 * Retorna erros quando ambos sao informados e divergem acima da tolerancia.
 * Regra usada por abastecimentos e pela troca de oleo (custo proprio).
 */
export function normalizeFuelValues(input: {
  litros: number;
  valorTotal?: number | null;
  precoLitro?: number | null;
}): {
  errors: string[];
  valorTotal: number;
  precoLitro: number;
} {
  const litros = input.litros;
  const valorInformado = Number(input.valorTotal ?? NaN);
  const precoInformado = Number(input.precoLitro ?? NaN);
  const errors: string[] = [];

  let valorTotal = valorInformado;
  let precoLitro = precoInformado;

  const temValor = Number.isFinite(valorInformado) && valorInformado > 0;
  const temPreco = Number.isFinite(precoInformado) && precoInformado > 0;

  if (litros > 0) {
    if (temValor && temPreco) {
      const calculado = litros * precoInformado;
      if (Math.abs(calculado - valorInformado) > TOLERANCIA_VALOR) {
        errors.push(
          "Valor total e preço por litro divergem acima da tolerância de R$ 0,10.",
        );
      } else {
        precoLitro = round3(valorInformado / litros);
      }
    } else if (temValor) {
      precoLitro = round3(valorInformado / litros);
    } else if (temPreco) {
      valorTotal = round2(litros * precoInformado);
    }
  }

  return { errors, valorTotal, precoLitro };
}

/** Maior quilometragem anterior do veiculo ate a data informada. */
export function previousKm(
  data: DadosFrota,
  veiculoId: string,
  dataHora: string,
): Abastecimento | null {
  const anteriores = data.abastecimentos.filter(
    (a) => a.veiculoId === veiculoId && a.dataHora <= dataHora,
  );
  if (!anteriores.length) return null;
  return anteriores.reduce((maior, atual) =>
    atual.quilometragem > maior.quilometragem ? atual : maior,
  );
}
