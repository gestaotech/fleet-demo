/* Auxiliares de apresentação (HTML seguro, tabelas, avisos). Não contém regras de negócio. */
const UI = (function () {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function badge(text, tone = 'muted') {
    return `<span class="badge badge-${tone}">${esc(text)}</span>`;
  }

  function situacaoBadge(situacao) {
    return badge(situacao, situacao === 'Ativo' ? 'ok' : 'muted');
  }

  function operacionalBadge(status) {
    return badge(status, status === 'Em manutenção' ? 'warn' : 'ok');
  }

  function manutencaoBadge(status) {
    const tone = { Aberta: 'info', 'Em andamento': 'warn', Concluída: 'ok' }[status] || 'muted';
    return badge(status, tone);
  }

  function kpi(label, value, hint = '') {
    return `<div class="card kpi"><span class="kpi-label">${esc(label)}</span><strong class="kpi-value">${esc(value)}</strong>${hint ? `<span class="kpi-hint">${esc(hint)}</span>` : ''}</div>`;
  }

  function pageHeader(title, subtitle = '', actions = '') {
    return `<header class="page-header"><div><h1>${esc(title)}</h1>${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
  }

  /* columns: [{ label, align: 'left'|'right' }]; rows: array de arrays de HTML já tratado. */
  function table(columns, rows, emptyText = 'Nenhum registro encontrado.') {
    const head = columns.map(c => `<th class="${c.align === 'right' ? 'num' : ''}">${esc(c.label)}</th>`).join('');
    const body = rows.length
      ? rows.map(row => `<tr>${row.map((cell, i) => `<td class="${columns[i] && columns[i].align === 'right' ? 'num' : ''}">${cell}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length}" class="empty">${esc(emptyText)}</td></tr>`;
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function errorBox(errors) {
    if (!errors || !errors.length) return '';
    return `<div class="alert alert-error" role="alert"><strong>Não foi possível concluir:</strong><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
  }

  function successBox(message) {
    return `<div class="alert alert-success" role="status">${esc(message)}</div>`;
  }

  function showErrors(container, errors) {
    if (!container) return;
    container.innerHTML = errorBox(errors);
    container.scrollIntoView({ block: 'nearest' });
  }

  function option(value, label, selected = false) {
    return `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
  }

  /*
   * Seletor de mês e ano a partir das opções { value, label, selected } calculadas no núcleo.
   * O valor é o mês no formato AAAA-MM e a opção vazia significa "sem filtro de período".
   */
  function monthSelect(name, opcoes, extraAttrs = '') {
    const options = opcoes.map(o => option(o.value, o.label, Boolean(o.selected))).join('');
    return `<select name="${esc(name)}" id="${esc(name)}" ${extraAttrs}>${options}</select>`;
  }

  /* Lê o formulário em objeto. Checkboxes com o mesmo name viram array; checkbox único vira boolean. */
  function readForm(form) {
    const data = {};
    const formData = new FormData(form);
    const names = new Set([...form.elements].map(el => el.name).filter(Boolean));
    names.forEach(name => {
      const elements = [...form.querySelectorAll(`[name="${name}"]`)];
      const values = formData.getAll(name);
      if (elements.every(el => el.type === 'checkbox')) {
        data[name] = elements.length > 1 ? values : values.length > 0;
      } else {
        data[name] = values.length > 1 ? values : String(values[0] ?? '');
      }
    });
    return data;
  }

  /*
   * Barras de pesquisa digitada (placa de veículo, código ou descrição de peça), com sugestões.
   * A regra de correspondência está em core/search.js. Em formulários, um campo oculto guarda o id escolhido.
   */
  const SEARCH_NOUNS = { vehicle: 'veículo', part: 'peça' };

  function searchItems(kind, state, apenasAtivos) {
    if (kind === 'vehicle') {
      return state.veiculos
        .filter(v => !apenasAtivos || v.situacao === 'Ativo')
        .map(v => ({ value: v.placa, label: `${v.marca}${v.situacao === 'Inativo' ? ' (inativo)' : ''}` }));
    }
    return state.pecas.map(p => ({ value: p.codigo, label: p.descricao }));
  }

  function searchText(kind, state, id) {
    if (!id) return '';
    const registro = kind === 'vehicle' ? Vehicles.find(state, id) : Warehouse.findPart(state, id);
    if (!registro) return '';
    return kind === 'vehicle' ? registro.placa : registro.codigo;
  }

  /* opts: { id, name (filtro lido pelo módulo), forField (campo oculto ligado), placeholder, value, required, apenasAtivos } */
  function searchInput(kind, state, opts = {}) {
    const listId = `${opts.id || opts.name || opts.forField}-list`;
    const items = searchItems(kind, state, Boolean(opts.apenasAtivos));
    const attrs = [
      opts.id ? `id="${esc(opts.id)}"` : '',
      opts.name ? `name="${esc(opts.name)}"` : '',
      opts.forField ? `data-search-for="${esc(opts.forField)}"` : '',
      opts.apenasAtivos ? 'data-apenas-ativos' : '',
      opts.required ? 'required' : '',
    ].filter(Boolean).join(' ');
    return `<input type="text" data-search="${esc(kind)}" ${attrs} value="${esc(opts.value || '')}" placeholder="${esc(opts.placeholder || '')}" list="${esc(listId)}" autocomplete="off">
      <datalist id="${esc(listId)}">${items.map(i => `<option value="${esc(i.value)}">${esc(i.label)}</option>`).join('')}</datalist>`;
  }

  /* Campo de formulário: texto digitado + campo oculto com o id (name) + aviso. Use dentro de um <label class="field">. */
  function searchField(kind, state, opts) {
    return `${searchInput(kind, state, {
      id: opts.id, forField: opts.name, placeholder: opts.placeholder, required: opts.required,
      apenasAtivos: opts.apenasAtivos, value: searchText(kind, state, opts.selectedId),
    })}
      <input type="hidden" name="${esc(opts.name)}" value="${esc(opts.selectedId || '')}">
      <span class="hint" data-search-hint="${esc(opts.name)}"></span>`;
  }

  function searchHint(kind, state, result, busca) {
    if (result.id) {
      if (kind !== 'part') return '';
      const part = Warehouse.findPart(state, result.id);
      return `Saldo disponível: ${Warehouse.balance(state, part.id)} un. (${part.codigo} — ${part.descricao})`;
    }
    if (!Utils.normalizeText(busca)) return '';
    if (result.count > 1) return `${result.count} correspondências encontradas. Complete a busca ou escolha uma sugestão na lista.`;
    return `Nenhum ${SEARCH_NOUNS[kind]} encontrado para esta busca.`;
  }

  /*
   * Liga as barras de pesquisa de um formulário. Devolve a função que resolve os campos;
   * deve ser chamada antes de ler o formulário no envio.
   */
  function bindSearchFields(root, state) {
    const syncs = [...root.querySelectorAll('input[data-search-for]')].map(input => {
      const kind = input.dataset.search;
      const name = input.dataset.searchFor;
      const hidden = root.querySelector(`input[type="hidden"][name="${name}"]`);
      const hint = root.querySelector(`[data-search-hint="${name}"]`);
      const apenasAtivos = input.hasAttribute('data-apenas-ativos');
      const sync = () => {
        const busca = input.value;
        const result = kind === 'vehicle'
          ? Search.vehicle(state, busca, { apenasAtivos })
          : Search.part(state, busca);
        const anterior = hidden.value;
        hidden.value = result.id || '';
        hint.textContent = searchHint(kind, state, result, busca);
        if (hidden.value !== anterior) hidden.dispatchEvent(new Event('change', { bubbles: true }));
      };
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
      sync();
      return sync;
    });
    return () => syncs.forEach(sync => sync());
  }

  function toast(message, tone = 'success') {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const item = document.createElement('div');
    item.className = `toast toast-${tone}`;
    item.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    item.textContent = message;
    region.appendChild(item);
    setTimeout(() => item.classList.add('toast-hide'), 3800);
    setTimeout(() => item.remove(), 4300);
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  return {
    esc, badge, situacaoBadge, operacionalBadge, manutencaoBadge, kpi, pageHeader,
    table, errorBox, successBox, showErrors, option, monthSelect, readForm, toast, confirmAction,
    searchInput, searchField, bindSearchFields,
  };
})();
