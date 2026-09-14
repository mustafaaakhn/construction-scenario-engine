(() => {

const form = document.querySelector('#project-form');
const planRows = document.querySelector('#plan-rows');
const error = document.querySelector('#error');
const results = document.querySelector('#results');
const placeholder = document.querySelector('#result-placeholder');
let items = structuredClone(defaultItems);
let columns = {};
const fields = ['name', 'contractValue', 'initialCash', 'monthlyOverhead', 'monthlyRate', 'paymentDelay'];
let scenarioFields = [];
const number = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const currency = document.querySelector('#currency');
const language = document.querySelector('#language');
const money = (value) => `${number.format(value)} ${currency.value}`;
const input = (name) => form.elements.namedItem(name);
const saveStatus = document.querySelector('#save-status');
const thresholdForm = document.querySelector('#threshold-form');
const targetMargin = document.querySelector('#target-margin');
const creditLimit = document.querySelector('#credit-limit');
const scenarioName = document.querySelector('#scenario-name');
const scenarioStatus = document.querySelector('#scenario-status');
let scenarios = [];
let plan = [];
let chart;
const hiddenLines = new Set();
let calculated;
translatePage();

function caseName(entry) {
  return entry.changes === null ? t('Base') : entry.name;
}

language.addEventListener('change', () => {
  setLanguage(language.value);
  translatePage();
  readPlan().forEach((month, i) => { plan[i] = month; });
  renderItemControls();
  renderPlan(planRows.rows.length);
  renderScenarios();
  document.querySelector('#item-status').textContent = t('Add your own costs. Use × in a column heading to remove an item.');
  for (const field of document.querySelectorAll('[data-money]')) updateAmount(field);
  if (calculated) {
    const entries = calculated.entries;
    [...document.querySelector('#detail-view').options].forEach((option, index) => {
      option.textContent = caseName(entries[index]);
    });
    document.querySelector('#result-caption').textContent = entries.length > 1 ? t('SCENARIO COMPARISON') : t('BASE CASE');
    document.querySelector('#results-heading').textContent = entries.length > 1 ? t('Compare the results') : t('Project summary');
    document.querySelector('#result-status').textContent = t('Done. Calculated the base case and {0} scenarios.', entries.length - 1);
  } else {
    markChanged();
  }
  showCurrency();
  if (document.querySelector('#threshold-results').hidden) {
    document.querySelector('#threshold-status').textContent = t('Enter your targets, then check the limits.');
  }
  error.hidden = true;
  document.querySelector('#page-note').textContent = t('Language changed. Your inputs are unchanged.');
  saveDraft();
});

function showCurrency() {
  for (const label of document.querySelectorAll('[data-currency]')) label.textContent = currency.value;
  [...planRows.rows].forEach((row, index) => {
    row.querySelector('th').textContent = t('Month {0}', index + 1);
    for (const field of row.querySelectorAll('input')) {
      field.setAttribute('aria-label', t("Month {0} {1} ({2})", index + 1, columns[field.dataset.key], currency.value));
    }
  });
  updateTotals();
  if (!calculated) return;
  showSelectedResult();
  if (calculated.entries.length > 1) showComparison(calculated.entries);
  drawChart(calculated.project, calculated.entries);
  if (!document.querySelector('#threshold-results').hidden) showThresholds();
}

currency.addEventListener('change', () => {
  showCurrency();
  saveDraft();
});

function renderItemControls(values) {
  values ??= Object.fromEntries(scenarioFields.map((key) => [key, input(key)?.value ?? '0']));
  columns = { claim: t('Billed'), ...Object.fromEntries(items.map((item) => [item.key, itemName(item)])) };
  scenarioFields = [...items.map((item) => item.key), 'extraDelay', 'extraMonths'];
  const container = document.querySelector('#cost-changes');
  container.replaceChildren();
  for (const item of items) {
    const label = document.createElement('label');
    label.textContent = t('{0} change', itemName(item));
    const unit = document.createElement('span');
    unit.className = 'input-unit';
    const field = document.createElement('input');
    field.type = 'number';
    field.name = item.key;
    field.min = -100;
    field.max = 1000;
    field.step = 0.01;
    field.required = true;
    field.value = values[item.key] ?? 0;
    const suffix = document.createElement('span');
    suffix.textContent = '%';
    unit.append(field, suffix);
    label.append(unit);
    container.append(label);
  }
  for (const key of ['extraDelay', 'extraMonths']) input(key).value = values[key] ?? 0;
  const select = document.querySelector('#limit-item');
  const selected = select.value;
  select.replaceChildren();
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = itemName(item);
    select.append(option);
  }
  if (items.some((item) => item.key === selected)) select.value = selected;
  select.disabled = items.length === 0;
}

function renderPlanHead() {
  const head = document.querySelector('#plan-head');
  const foot = document.querySelector('#plan-foot');
  head.replaceChildren();
  foot.replaceChildren();
  const month = document.createElement('th');
  month.scope = 'col';
  month.textContent = t('Month');
  head.append(month);
  const total = document.createElement('th');
  total.scope = 'row';
  total.textContent = t('Total');
  foot.append(total);
  for (const [key, name] of Object.entries(columns)) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    const label = document.createElement('span');
    label.textContent = name;
    cell.append(label);
    if (key !== 'claim') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-item';
      remove.textContent = '×';
      remove.setAttribute('aria-label', t('Remove cost item: {0}', name));
      remove.addEventListener('click', () => removeItem(key));
      cell.append(remove);
    }
    head.append(cell);
    const sum = document.createElement('td');
    sum.id = `sum-${key}`;
    foot.append(sum);
  }
}

function itemsChanged() {
  renderItemControls();
  renderPlan(planRows.rows.length);
  renderScenarios();
  markChanged();
  saveDraft();
  document.querySelector('#item-status').textContent = t('Cost items changed. Calculate again to update all scenarios.');
}

function removeItem(key) {
  const item = items.find((entry) => entry.key === key);
  if (!window.confirm(t('Remove {0}? Its monthly amounts and saved scenario changes will be deleted.', itemName(item)))) return;
  readPlan().forEach((month, i) => { plan[i] = month; });
  items = items.filter((entry) => entry.key !== key);
  for (const month of plan) delete month[key];
  for (const scenario of scenarios) delete scenario.changes[key];
  itemsChanged();
  document.querySelector('#add-item').focus();
}

document.querySelector('#add-item').addEventListener('click', () => {
  const field = document.querySelector('#item-name');
  const name = field.value.trim();
  if (!name || items.some((item) => itemName(item).toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
    document.querySelector('#item-status').textContent = t('Enter a new, different cost item name.');
    field.focus();
    return;
  }
  readPlan().forEach((month, i) => { plan[i] = month; });
  const key = `cost_${crypto.randomUUID()}`;
  items.push({ key, name });
  for (const scenario of scenarios) scenario.changes[key] = 0;
  itemsChanged();
  field.value = '';
  planRows.querySelector(`input[data-key="${key}"]`).focus();
});

document.querySelector('#item-name').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  document.querySelector('#add-item').click();
});

function readPlan() {
  return [...planRows.rows].map((row) => {
    const month = {};
    for (const field of row.querySelectorAll('input')) {
      month[field.dataset.key] = field.value;
    }
    return month;
  });
}

function readMonths() {
  return readPlan().map((month) => Object.fromEntries(
    Object.entries(month).map(([key, value]) => [key, readAmount(value)]),
  ));
}

function readField(field) {
  return field.hasAttribute('data-money') ? readAmount(field.value) : field.valueAsNumber;
}

function snapshot() {
  return {
    app: 'construction-scenario-engine', version: 1,
    items,
    currency: currency.value,
    language: language.value,
    fields: Object.fromEntries([...fields, 'duration'].map((key) => [key, input(key).value])),
    scenario: Object.fromEntries(scenarioFields.map((key) => [key, input(key).value])),
    scenarios,
    scenarioName: scenarioName.value,
    months: readPlan(),
    limits: { margin: targetMargin.value, credit: creditLimit.value },
  };
}

function saveDraft() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot()));
    saveStatus.textContent = t('Saved in this browser.');
    saveStatus.classList.remove('negative');
  } catch {
    saveStatus.textContent = t('Could not save in this browser. You can save a file instead.');
    saveStatus.classList.add('negative');
  }
}

function loadDraft(data) {
  language.value = data.language ?? 'en';
  setLanguage(language.value);
  translatePage();
  hiddenLines.clear();
  currency.value = data.currency ?? 'EUR';
  for (const [key, value] of Object.entries(data.fields)) input(key).value = value;
  items = structuredClone(getItems(data));
  renderItemControls(data.scenario);
  scenarios = (data.scenarios ?? []).map((entry) => ({
    ...entry, changes: Object.fromEntries(scenarioFields.map((key) => [key, entry.changes[key] ?? 0])),
  }));
  scenarioName.value = data.scenarioName ?? '';
  renderScenarios();
  plan = data.months;
  targetMargin.value = data.limits?.margin ?? '10';
  creditLimit.value = data.limits?.credit ?? '1.000.000';
  updateAmount(creditLimit);
  renderPlan(plan.length);
  for (const field of form.querySelectorAll('[data-money]')) updateAmount(field);
  markChanged();
  showCurrency();
}

function renderPlan(duration) {
  renderPlanHead();
  planRows.replaceChildren();
  for (let i = 0; i < duration; i++) {
    plan[i] ??= {};
    for (const key of Object.keys(columns)) plan[i][key] ??= 0;
    const row = planRows.insertRow();
    row.innerHTML = `<th scope="row">${t('Month {0}', i + 1)}</th>`;
    for (const [key, label] of Object.entries(columns)) {
      const field = document.createElement('input');
      field.type = 'text';
      field.inputMode = 'decimal';
      field.maxLength = 100;
      field.setAttribute('data-money', '');
      field.required = true;
      field.dataset.key = key;
      field.setAttribute('aria-label', t("Month {0} {1} ({2})", i + 1, label, currency.value));
      field.value = typeof plan[i][key] === 'string' || Number.isFinite(plan[i][key]) ? displayAmount(plan[i][key]) : '';
      updateAmount(field);
      row.insertCell().append(field);
    }
  }
  updateTotals();
}

function updateTotals() {
  const months = readMonths();
  const totals = {};
  for (const key of Object.keys(columns)) {
    totals[key] = months.reduce((sum, month) => sum + Math.round((month[key] || 0) * 100), 0);
    document.querySelector(`#sum-${key}`).textContent = number.format(totals[key] / 100);
  }
  const difference = Math.round(readField(input('contractValue')) * 100) - totals.claim;
  const check = document.querySelector('#claim-check');
  check.classList.toggle('mismatch', difference !== 0);
  check.textContent = !Number.isFinite(difference) ? t('Enter the contract value.')
    : difference === 0 ? t('✓ Total billing matches the contract value.')
    : difference > 0 ? t("Total billing is {0} short.", money(difference / 100))
    : t("Total billing is {0} too high.", money(-difference / 100));
}

function markChanged() {
  results.hidden = true;
  placeholder.hidden = false;
  document.querySelector('#result-name').textContent = '';
  document.querySelector('#result-status').textContent = t('Inputs changed. Calculate again to update the results.');
  error.hidden = true;
  calculated = null;
}

function loadEmptyProject() {
  loadProject({
    name: '', contractValue: '', initialCash: 0, monthlyOverhead: 0, monthlyRate: 0, paymentDelay: 0,
    months: Array.from({ length: 6 }, () => ({ claim: 0, steel: 0, concrete: 0, labor: 0, other: 0 })),
  });
  document.querySelector('#page-note').textContent = t('Enter the details and monthly plan for a new project.');
}

function loadProject(project) {
  items = structuredClone(getItems(project));
  renderItemControls({});
  hiddenLines.clear();
  scenarios = [];
  scenarioName.value = '';
  renderScenarios();
  targetMargin.value = '10';
  creditLimit.value = '1.000.000';
  updateAmount(creditLimit);
  for (const key of fields) {
    input(key).value = input(key).hasAttribute('data-money') ? displayAmount(project[key]) : key === 'name' ? t(project[key]) : project[key];
    if (input(key).hasAttribute('data-money')) updateAmount(input(key));
  }
  input('duration').value = project.months.length;
  plan = structuredClone(project.months);
  renderPlan(project.months.length);
  setScenario({});
  markChanged();
  showCurrency();
}

function setScenario(changes) {
  for (const key of scenarioFields) input(key).value = changes[key] ?? 0;
  scenarioStatus.textContent = t('Fields are ready. Add this scenario to compare it.');
}

function describeChanges(changes) {
  const labels = { ...columns, extraDelay: t('Delay'), extraMonths: t('Duration') };
  return scenarioFields.filter((key) => (changes[key] ?? 0) !== 0).map((key) => {
    const value = changes[key];
    const isMonth = key === 'extraDelay' || key === 'extraMonths';
    return `${labels[key]} ${value < 0 ? '−' : '+'}${number.format(Math.abs(value))}${isMonth ? ` ${t(value === 1 ? 'month' : 'months')}` : '%'}`;
  }).join(' · ') || t('Same as the base case');
}

function renderScenarios() {
  const list = document.querySelector('#saved-scenarios');
  list.replaceChildren();
  scenarios.forEach((item, index) => {
    const row = document.createElement('li');
    const description = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const conditions = document.createElement('p');
    conditions.textContent = describeChanges(item.changes);
    description.append(name, conditions);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button muted';
    remove.textContent = t('Remove');
    remove.setAttribute('aria-label', t("Remove {0}", item.name));
    remove.addEventListener('click', () => {
      scenarios.splice(index, 1);
      renderScenarios();
      markChanged();
      saveDraft();
      runCalculation(false);
      scenarioStatus.textContent = t("{0} removed from the comparison.", item.name);
      document.querySelector('#add-scenario').focus();
    });
    row.append(description, remove);
    list.append(row);
  });
  document.querySelector('#scenario-count').textContent = t("{0} / 3 scenarios", scenarios.length);
  document.querySelector('#add-scenario').disabled = scenarios.length === 3;
  scenarioStatus.textContent = scenarios.length === 3
    ? t('Three scenarios added. Remove one to add another.')
    : t('Only saved scenarios are compared. Editing these fields does not change the saved ones.');
}

function showResults(project, base, variants) {
  const entries = [{ name: 'Base', project, result: base, changes: null }, ...variants];
  calculated = { project, entries };
  const select = document.querySelector('#detail-view');
  const previous = select.selectedOptions[0]?.textContent;
  select.replaceChildren();
  entries.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = caseName(entry);
    select.append(option);
  });
  const selected = entries.findIndex((entry) => caseName(entry) === previous);
  select.value = selected < 0 ? 0 : selected;
  document.querySelector('#comparison').hidden = !variants.length;
  if (variants.length) showComparison(entries);
  document.querySelector('#result-caption').textContent = variants.length ? t('SCENARIO COMPARISON') : t('BASE CASE');
  document.querySelector('#results-heading').textContent = variants.length ? t('Compare the results') : t('Project summary');
  showSelectedResult();
  results.hidden = false;
  placeholder.hidden = true;
  drawChart(project, entries);
  showThresholds();
  document.querySelector('#result-status').textContent = t("Done. Calculated the base case and {0} scenarios.", variants.length);
}

function showSelectedResult() {
  const entry = calculated.entries[Number(document.querySelector('#detail-view').value)];
  const result = entry.result;
  const amounts = {
    profit: result.profit,
    'max-debt': result.maxDebt,
    'finance-cost': result.financeCost,
    revenue: result.revenue,
    'total-costs': result.totalCosts,
    'breakdown-finance': result.financeCost,
    'breakdown-profit': result.profit,
    'final-balance': result.finalBalance,
  };
  for (const [id, value] of Object.entries(amounts)) {
    document.getElementById(id).textContent = money(value);
  }
  document.querySelector('#margin').textContent = result.margin === null ? '—' : `${number.format(result.margin)}%`;
  document.querySelector('#worst-month').textContent = result.worstMonth === null
    ? t('No borrowing needed') : t("Peak debt: month {0}", result.worstMonth);
  document.querySelector('.profit-card').classList.toggle('loss', result.profit < 0);
  document.querySelector('#final-balance').classList.toggle('negative', result.finalBalance < 0);
  document.querySelector('#result-name').textContent = t("{0} · {1} · {2} months of work", calculated.project.name, caseName(entry), entry.project.months.length);
  document.querySelector('#breakdown-heading').textContent = t("{0} · Cost breakdown", caseName(entry));
  document.querySelector('#cash-caption').textContent = t("Monthly results for {0}, {1}", caseName(entry), currency.value);
  showCashRows(result);
}

function showThresholds() {
  const output = document.querySelector('#threshold-results');
  const message = document.querySelector('#threshold-status');
  output.hidden = true;
  if (!calculated || !thresholdForm.checkValidity()) {
    message.textContent = t('Enter your targets, then check the limits.');
    return;
  }
  try {
    const margin = targetMargin.valueAsNumber;
    const credit = readAmount(creditLimit.value);
    const selectedItem = items.find((item) => item.key === document.querySelector('#limit-item').value);
    document.querySelector('#cost-limit-heading').textContent = selectedItem ? t('{0} rise → loss', itemName(selectedItem)) : '';
    const { cost, duration, delay } = findThresholds(calculated.project, margin, credit, document.querySelector('#limit-item').value);
    document.querySelector('#cost-limit-card').hidden = cost.status === 'empty';
    const project = calculated.project;
    const write = (id, title, detail) => {
      document.querySelector(`#${id}-value`).textContent = title;
      document.querySelector(`#${id}-detail`).textContent = detail;
    };
    if (cost.status === 'already') write('cost-limit', t('Base project already loses money'), t("Base profit: {0}.", money(cost.result.profit)));
    else if (cost.status === 'not-found') write('cost-limit', t('No loss up to +1.000%'), t('No loss found in this range. Larger increases were not checked.'));
    else if (cost.status === 'found') write('cost-limit', `+${number.format(cost.value)}%`, t("First loss: {0}. At +{1}%, profit was {2}.", money(cost.result.profit), number.format(cost.previousValue), money(cost.previous.profit)));

    if (duration.status === 'undefined') write('duration-limit', t('Margin is not available'), t('Profit margin cannot be calculated with a zero contract value.'));
    else if (duration.status === 'already') write('duration-limit', t('Base margin is below the target'), t("Base margin: {0}%. Target: {1}%.", number.format(duration.result.margin), number.format(margin)));
    else if (duration.status === 'not-found') write('duration-limit', t('No limit found in this range'), t("Checked 0–{0} extra months. Total work duration is limited to 120 months.", duration.max));
    else write('duration-limit', `+${duration.value} ${duration.value === 1 ? t('month') : t('months')}`, t("At {0} months of work, the margin is {1}%. One month earlier: {2}%. Target: {3}%.", project.months.length + duration.value, number.format(duration.result.margin), number.format(duration.previous.margin), number.format(margin)));

    if (delay.status === 'already') write('delay-limit', t('Base borrowing is already over the limit'), t("Borrowing needed: {0}. Your limit: {1}.", money(delay.result.maxDebt), money(credit)));
    else if (delay.status === 'not-found') write('delay-limit', t('No breach found in this range'), t("Checked 0–{0} extra months of delay. Total delay is limited to 120 months.", delay.max));
    else write('delay-limit', `+${delay.value} ${delay.value === 1 ? t('month') : t('months')}`, t("With a total delay of {0} months, borrowing reaches {1}, which is {2} above the limit. One month earlier: {3}.", project.paymentDelay + delay.value, money(delay.result.maxDebt), money(Math.round((delay.result.maxDebt - credit) * 100) / 100), money(delay.previous.maxDebt)));
    message.textContent = t('Each check starts from the base project. Saved scenarios are not included in these checks.');
    output.hidden = false;
  } catch (problem) {
    message.textContent = problem.message;
  }
}

thresholdForm.addEventListener('input', (event) => {
  if (event.target === creditLimit) updateAmount(creditLimit);
  document.querySelector('#threshold-results').hidden = true;
  document.querySelector('#threshold-status').textContent = t('Targets changed. Check the limits again.');
  saveDraft();
});

thresholdForm.addEventListener('submit', (event) => {
  event.preventDefault();
  showThresholds();
});

function showCashRows(result) {
  document.querySelector('#cash-rows').innerHTML = result.rows.map((row) => `
    <tr class="${row.month === result.worstMonth ? 'worst' : ''}">
      <th scope="row">${t('Month {0}', row.month)}</th>
      <td>${number.format(row.claim)}</td><td>${number.format(row.received)}</td>
      <td>${number.format(row.costs)}</td><td>${number.format(row.interest)}</td>
      <td class="${row.balance < 0 ? 'negative' : ''}">${number.format(row.balance)}</td>
    </tr>`).join('');
}

function showComparison(entries) {
  const head = document.querySelector('#comparison-head');
  head.replaceChildren();
  for (const name of [t('Metric'), ...entries.map((entry) => caseName(entry))]) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = name;
    head.append(cell);
  }
  const rows = [
    [t('Profit before tax'), (entry) => entry.result.profit, 'money', true],
    [t('Profit margin'), (entry) => entry.result.margin, 'margin', true],
    [t('Work costs and overhead'), (entry) => entry.result.totalCosts, 'money', false],
    [t('Loan interest cost'), (entry) => entry.result.financeCost, 'money', false],
    [t('Peak borrowing'), (entry) => entry.result.maxDebt, 'money', false],
    [t('Month of peak debt'), (entry) => entry.result.worstMonth, 'month'],
    [t('Work duration'), (entry) => entry.project.months.length, 'duration'],
    [t('Payment delay'), (entry) => entry.project.paymentDelay, 'duration'],
    [t('Final payment month'), (entry) => entry.result.rows.length, 'month'],
  ];
  const body = document.querySelector('#comparison-rows');
  body.replaceChildren();
  const conditions = body.insertRow();
  const title = document.createElement('th');
  title.scope = 'row';
  title.textContent = t('Changes');
  conditions.append(title);
  for (const entry of entries) {
    const cell = conditions.insertCell();
    cell.className = 'condition-cell';
    cell.textContent = entry.changes ? describeChanges(entry.changes) : t('Original plan');
  }
  for (const [label, getValue, type, higherIsBetter] of rows) {
    const row = body.insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    const before = getValue(entries[0]);
    entries.forEach((entry, index) => {
      const value = getValue(entry);
      const cell = row.insertCell();
      if (value === null) cell.textContent = '—';
      else if (type === 'money') cell.textContent = money(value);
      else if (type === 'margin') cell.textContent = `${number.format(value)}%`;
      else if (type === 'month') cell.textContent = t('Month {0}', value);
      else cell.textContent = `${value} ${value === 1 ? t('month') : t('months')}`;
      if (!index || higherIsBetter === undefined || value === null || before === null) return;
      const difference = Math.round((value - before) * 100) / 100;
      const change = document.createElement('small');
      change.className = difference === 0 ? 'muted' : (difference > 0) === higherIsBetter ? 'positive' : 'negative';
      change.textContent = t("vs base {0}{1}", difference > 0 ? '+' : '', type === 'money' ? money(difference) : t("{0} percentage points", number.format(difference)));
      cell.append(change);
    });
  }
  document.querySelector('#scenario-impact').textContent = t("Same base project · {0} scenarios", entries.length - 1);
}

function drawChart(project, entries) {
  const count = Math.max(...entries.map((entry) => entry.result.rows.length));
  const colors = ['#39745a', '#c15a20', '#286cb0', '#8950a0'];
  const dashes = [[8, 5], [], [3, 4], [10, 4, 2, 4]];
  const points = ['circle', 'rect', 'triangle', 'rectRot'];
  const datasets = entries.map((entry, index) => ({
    label: caseName(entry),
    data: [project.initialCash, ...entry.result.rows.map((row) => row.balance), ...Array(count - entry.result.rows.length).fill(null)],
    borderColor: colors[index],
    borderDash: dashes[index],
    borderWidth: 2.5,
    pointStyle: points[index],
    pointBackgroundColor: '#fff',
    pointBorderColor: colors[index],
    pointBorderWidth: 1.5,
    hidden: hiddenLines.has(entry.name),
    pointRadius: count > 24 ? 0 : 3,
    pointHoverRadius: 6,
    pointHitRadius: 10,
    fill: false,
  }));
  const legend = document.querySelector('#chart-legend');
  legend.replaceChildren();
  entries.forEach((entry, index) => {
    const label = document.createElement('button');
    label.type = 'button';
    label.setAttribute('aria-pressed', String(!hiddenLines.has(entry.name)));
    label.setAttribute('aria-controls', 'cash-chart');
    label.title = t("Show or hide {0}", caseName(entry));
    const line = document.createElement('i');
    line.style.borderTop = `3px ${index === 0 || index === 3 ? 'dashed' : index === 2 ? 'dotted' : 'solid'} ${colors[index]}`;
    line.setAttribute('aria-hidden', 'true');
    label.append(line, caseName(entry));
    label.addEventListener('click', () => {
      const visible = !chart.isDatasetVisible(index);
      chart.setDatasetVisibility(index, visible);
      if (visible) hiddenLines.delete(entry.name);
      else hiddenLines.add(entry.name);
      label.setAttribute('aria-pressed', String(visible));
      chart.update('none');
      document.querySelector('#chart-empty').hidden = entries.some((item) => !hiddenLines.has(item.name));
    });
    legend.append(label);
  });
  document.querySelector('#chart-empty').hidden = entries.some((entry) => !hiddenLines.has(entry.name));
  chart?.destroy();
  chart = new Chart(document.querySelector('#cash-chart'), {
    type: 'line',
    data: {
      labels: [t('Start'), ...Array.from({ length: count }, (_, i) => t("Month {0}", i + 1))],
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12, bodySpacing: 7, usePointStyle: true,
          callbacks: { label: (item) => `${item.dataset.label}: ${money(item.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#526057', font: { size: 11 }, maxTicksLimit: 10, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          title: { display: true, text: t("Balance ({0})", currency.value), color: '#526057' },
          border: { display: false },
          grid: { color: (context) => context.tick.value === 0 ? '#8c9c90' : '#edf0eb' },
          ticks: {
            color: '#526057', font: { size: 11 }, maxTicksLimit: 7, padding: 8,
            callback: (value) => new Intl.NumberFormat(language.value === 'tr' ? 'tr-TR' : 'en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value),
          },
        },
      },
    },
  });
}

function readProject(report) {
  const inputs = [...form.querySelectorAll('.workspace input')];
  const invalid = inputs.find((field) => !field.checkValidity());
  if (invalid) {
    if (report) invalid.reportValidity();
    return null;
  }
  const project = { items: structuredClone(items), months: readMonths() };
  for (const key of fields) project[key] = key === 'name' ? input(key).value.trim() : readField(input(key));
  if (!project.name) throw new Error(t('Enter a project name.'));
  return project;
}

function runCalculation(report = true) {
  try {
    const project = readProject(report);
    if (!project) return false;
    const base = calculate(project);
    const variants = scenarios.map((item) => {
      try {
        const updated = createScenario(project, item.changes);
        return { ...item, project: updated, result: calculate(updated) };
      } catch (problem) {
        throw new Error(`${item.name}: ${problem.message}`);
      }
    });
    error.hidden = true;
    showResults(project, base, variants);
    return true;
  } catch (problem) {
    error.textContent = problem.message;
    error.hidden = !report;
    results.hidden = true;
    placeholder.hidden = false;
    calculated = null;
    return false;
  }
}

document.querySelector('#add-scenario').addEventListener('click', () => {
  if (scenarios.length >= 3) return;
  for (const key of scenarioFields) if (!input(key).reportValidity()) return;
  if (!scenarioName.reportValidity()) return;
  const changes = Object.fromEntries(scenarioFields.map((key) => [key, input(key).valueAsNumber]));
  let count = 1;
  while (scenarios.some((item) => item.name.toLocaleLowerCase('tr-TR') === t('Scenario {0}', count).toLocaleLowerCase('tr-TR'))) count++;
  const name = scenarioName.value.trim() || t("Scenario {0}", count);
  try {
    if (['base', 'baz'].includes(name.toLocaleLowerCase('tr-TR')) || scenarios.some((item) => item.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
      throw new Error(t('Choose a name that differs from Base and the other scenarios.'));
    }
    const project = readProject(true);
    if (!project) return;
    calculate(project);
    calculate(createScenario(project, changes));
    scenarios.push({ name, changes });
    scenarioName.value = '';
    renderScenarios();
    markChanged();
    saveDraft();
    runCalculation();
    scenarioStatus.textContent = t("{0} added. {1}", name, scenarios.length === 3 ? t('You have reached the three-scenario limit.') : t('Change the fields to add another scenario.'));
  } catch (problem) {
    scenarioStatus.textContent = problem.message;
  }
});

form.addEventListener('input', (event) => {
  if (event.target.id === 'item-name') return;
  if (event.target.closest('#scenario-settings')) {
    scenarioStatus.textContent = t('Draft changed. Add it to the comparison when ready. Saved scenarios stay the same.');
    saveDraft();
    return;
  }
  if (event.target.matches('[data-money]')) updateAmount(event.target);
  markChanged();
  updateTotals();
  saveDraft();
  document.querySelector('#page-note').textContent = t('Base project changed. Calculate again to compare all scenarios with the updated base.');
});

document.addEventListener('beforeinput', (event) => {
  const field = event.target;
  if (!field.matches('[data-money]') || field.selectionStart !== field.selectionEnd) return;
  const position = field.selectionStart;
  let start = position;
  let end = position;
  if (event.inputType === 'deleteContentBackward' && field.value[position - 1] === '.') start -= 2;
  else if (event.inputType === 'deleteContentForward' && field.value[position] === '.') end += 2;
  else return;
  event.preventDefault();
  field.setRangeText('', Math.max(0, start), end, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
});

document.querySelector('#stress-example').addEventListener('click', () => {
  setScenario({ steel: 20, labor: 15, extraDelay: 2, extraMonths: 4 });
  saveDraft();
  document.querySelector('#page-note').textContent = t('Stress example filled in. Give it a name and click Add to comparison.');
});

document.querySelector('#reset-scenario').addEventListener('click', () => {
  setScenario({});
  saveDraft();
  document.querySelector('#page-note').textContent = t('Draft fields reset. Saved scenarios are unchanged.');
});

document.querySelector('#detail-view').addEventListener('change', () => {
  if (calculated) showSelectedResult();
});

input('duration').addEventListener('input', () => {
  if (!input('duration').checkValidity()) return;
  // Kısaltılan plan tekrar uzatılırsa eski ayların girişleri korunur.
  readPlan().forEach((month, i) => { plan[i] = month; });
  renderPlan(input('duration').valueAsNumber);
});

document.querySelector('#distribute').addEventListener('click', () => {
  if (!input('contractValue').reportValidity() || !input('duration').reportValidity()) return;
  readPlan().forEach((month, i) => { plan[i] = month; });
  const count = planRows.rows.length;
  const cents = Math.round(readField(input('contractValue')) * 100);
  for (let i = 0; i < count; i++) {
    plan[i].claim = (Math.floor(cents / count) + (i < cents % count ? 1 : 0)) / 100;
  }
  renderPlan(count);
  markChanged();
  saveDraft();
});

form.addEventListener('invalid', (event) => {
  const panel = event.target.closest('details');
  if (panel) panel.open = true;
}, true);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#calculate-project');
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('loading');
  button.setAttribute('aria-busy', 'true');
  document.querySelector('#result-status').textContent = t('Calculating…');
  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (runCalculation()) {
      document.querySelector('#results-section').scrollIntoView({ block: 'start' });
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        results.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 250, easing: 'ease-out',
        });
      }
    }
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.removeAttribute('aria-busy');
  }
});

document.querySelector('#load-example').addEventListener('click', () => {
  if (!window.confirm(t('Replace your current inputs with the example project?'))) return;
  loadProject(sampleProject);
  runCalculation();
  saveDraft();
  document.querySelector('#page-note').textContent = t('Example loaded: a made-up six-month housing project.');
});

document.querySelector('#clear').addEventListener('click', () => {
  if (!window.confirm(t('Clear the form and replace the project saved in this browser?'))) return;
  loadEmptyProject();
  saveDraft();
  document.querySelector('#page-note').textContent = t('Enter the details and monthly plan for a new project.');
  input('name').focus();
});

document.querySelector('#export-project').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(input('name').value.trim() || 'insaat-projesi').replace(/[\\/:*?"<>|]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#page-note').textContent = t('File download started. Unfinished inputs are included too.');
});

const fileInput = document.querySelector('#project-file');
document.querySelector('#import-project').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error(t('The project file must be no larger than 1 MB.'));
    const data = readSave(await file.text());
    loadDraft(data);
    saveDraft();
    const complete = runCalculation(false);
    document.querySelector('#page-note').textContent = complete ? t('Project file opened and calculated.')
      : t('Project file opened. Check the incomplete or inconsistent inputs, then calculate again.');
  } catch (problem) {
    document.querySelector('#page-note').textContent = t("{0} Your current inputs were kept.", problem.message);
  }
  fileInput.value = '';
});

try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    loadDraft(readSave(saved));
    const complete = runCalculation(false);
    document.querySelector('#page-note').textContent = complete ? t('Your last saved project is open.')
      : t('Saved draft opened. Complete or correct the inputs, then calculate again.');
    saveStatus.textContent = t('Loaded from this browser.');
  } else {
    loadEmptyProject();
    saveStatus.textContent = t('Changes are saved as you type.');
  }
} catch {
  loadEmptyProject();
  document.querySelector('#page-note').textContent = t('Could not read the browser save. A blank form is open; you can open a backup file.');
  saveStatus.textContent = t('Could not load the saved project. Your old save has not been replaced.');
  saveStatus.classList.add('negative');
}

})();
