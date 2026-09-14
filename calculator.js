function toCents(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(t("{0} must be zero or a positive number.", label));
  }
  return Math.round(value * 100);
}

function calculate(project) {
  const { months, paymentDelay, monthlyRate } = project;

  if (!Array.isArray(months) || months.length === 0) {
    throw new Error(t('A work plan with at least one month is required.'));
  }
  if (!Number.isInteger(paymentDelay) || paymentDelay < 0 || paymentDelay > 120) {
    throw new Error(t('Payment delay must be in whole months from 0 to 120.'));
  }
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0 || monthlyRate > 100) {
    throw new Error(t('Monthly interest rate must be between 0% and 100%.'));
  }

  const contract = toCents(project.contractValue, t('Contract value'));
  const overhead = toCents(project.monthlyOverhead, t('Monthly overhead'));
  let balance = toCents(project.initialCash, t('Starting cash'));
  const plan = months.map((month) => ({
    claim: toCents(month.claim, t('Billed')),
    costs: getItems(project).reduce((sum, item) => sum + toCents(month[item.key], itemName(item)), overhead),
  }));

  if (plan.reduce((sum, month) => sum + month.claim, 0) !== contract) {
    throw new Error(t('Total monthly billing must equal the contract value.'));
  }

  let totalCosts = 0;
  let financeCost = 0;
  let maxDebt = 0;
  let worstMonth = null;
  const rows = [];

  // Tutarlar hesap boyunca kuruş cinsinden tutulur; faiz her ay yuvarlanır.
  for (let i = 0; i < plan.length + paymentDelay; i++) {
    const costs = plan[i]?.costs ?? 0;
    const received = plan[i - paymentDelay]?.claim ?? 0;
    const interest = Math.round(Math.max(0, -balance) * monthlyRate / 100);
    balance += received - costs - interest;
    const debt = Math.max(0, -balance);

    totalCosts += costs;
    financeCost += interest;
    if (debt > maxDebt) {
      maxDebt = debt;
      worstMonth = i + 1;
    }

    rows.push({
      month: i + 1,
      claim: (plan[i]?.claim ?? 0) / 100,
      received: received / 100,
      costs: costs / 100,
      interest: interest / 100,
      balance: balance / 100,
      debt: debt / 100,
    });
  }

  const profit = contract - totalCosts - financeCost;
  return {
    revenue: contract / 100,
    totalCosts: totalCosts / 100,
    financeCost: financeCost / 100,
    profit: profit / 100,
    margin: contract === 0 ? null : profit / contract * 100,
    maxDebt: maxDebt / 100,
    worstMonth,
    finalBalance: balance / 100,
    rows,
  };
}
