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
  };
})();
