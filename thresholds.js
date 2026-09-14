
function search(project, key, max, crossed, percent = false) {
  const run = (value) => calculate(createScenario(project, { [key]: percent ? value / 100 : value }));
  const base = run(0);
  if (crossed(base)) return { status: 'already', value: 0, result: base };

  let first;
  if (percent) {
    if (!crossed(run(max))) return { status: 'not-found', max: max / 100 };
    let low = 0;
    let high = max;
    // Kalem bütçesi arttıkça kâr artamaz; yüzdeyi 0,01 adımlarla daraltabiliriz.
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (crossed(run(middle))) high = middle;
      else low = middle;
    }
    first = high;
  } else {
    // Süre uzamasında takvim dağılımı değişir; ilk aşımı ay ay ararız.
    for (let value = 1; value <= max; value++) {
      if (crossed(run(value))) { first = value; break; }
    }
    if (first === undefined) return { status: 'not-found', max };
  }
  return {
    status: 'found',
    value: percent ? first / 100 : first,
    previousValue: percent ? (first - 1) / 100 : first - 1,
    result: run(first),
    previous: run(first - 1),
  };
}

function findThresholds(project, margin, credit, costKey = 'steel') {
  if (!Number.isFinite(margin) || margin < 0 || margin > 100) throw new Error(t('Target margin must be between 0% and 100%.'));
  if (!Number.isFinite(credit) || credit < 0 || credit > 1_000_000_000_000) throw new Error(t('Enter a valid borrowing limit.'));
  calculate(project);
  return {
    cost: getItems(project).some((item) => item.key === costKey)
      ? search(project, costKey, 100_000, (result) => result.profit < 0, true) : { status: 'empty' },
    duration: project.contractValue === 0 ? { status: 'undefined' }
      : search(project, 'extraMonths', 120 - project.months.length, (result) => result.margin < margin),
    delay: search(project, 'extraDelay', 120 - project.paymentDelay, (result) => result.maxDebt > credit),
  };
}
