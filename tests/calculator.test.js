(() => {

function sample(changes = {}) {
  return {
    contractValue: 2_000,
    initialCash: 0,
    monthlyOverhead: 100,
    monthlyRate: 0,
    paymentDelay: 0,
    months: [
      { claim: 1_000, steel: 200, concrete: 100, labor: 200, other: 100 },
      { claim: 1_000, steel: 200, concrete: 100, labor: 200, other: 100 },
    ],
    ...changes,
  };
}

test('Baz hesap: 2.000 TL gelir, 1.400 TL gider, 600 TL kâr', () => {
  const result = calculate(sample());
  assert.equal(result.totalCosts, 1_400);
  assert.equal(result.profit, 600);
  assert.equal(result.margin, 30);
  assert.equal(result.finalBalance, 600);
  assert.equal(result.maxDebt, 0);
  assert.equal(result.worstMonth, null);
});

test('Faizsiz gecikme kârı değiştirmez, 700 TL kredi ihtiyacı oluşturur', () => {
  const result = calculate(sample({ paymentDelay: 1 }));
  assert.equal(result.profit, 600);
  assert.equal(result.maxDebt, 700);
  assert.equal(result.worstMonth, 1);
  assert.deepEqual(result.rows.map((row) => row.balance), [-700, -400, 600]);
  assert.equal(result.rows[2].costs, 0);
});

test('Faiz açılış borcuna uygulanır ve son tahsilata kadar hesaplanır', () => {
  const result = calculate(sample({ paymentDelay: 1, monthlyRate: 10 }));
  assert.deepEqual(result.rows.map((row) => row.interest), [0, 70, 47]);
  assert.equal(result.financeCost, 117);
  assert.equal(result.profit, 483);
  assert.equal(result.finalBalance, 483);
});

test('Başlangıç nakdi finansman ihtiyacını karşılar ama gelir sayılmaz', () => {
  const result = calculate(sample({ paymentDelay: 1, monthlyRate: 10, initialCash: 700 }));
  assert.equal(result.maxDebt, 0);
  assert.equal(result.financeCost, 0);
  assert.equal(result.profit, 600);
  assert.equal(result.finalBalance, 1_300);
});

test('Zarar eden işte son tahsilattan sonra kalan borç gösterilir', () => {
  const result = calculate(sample({ monthlyOverhead: 600 }));
  assert.equal(result.profit, -400);
  assert.equal(result.finalBalance, -400);
  assert.equal(result.maxDebt, 400);
  assert.equal(result.worstMonth, 2);
});

test('Kuruşlu tutarlar toplamda kaybolmaz', () => {
  const result = calculate(sample({
    contractValue: 0.3,
    monthlyOverhead: 0,
    months: [
      { claim: 0.1, steel: 0.01, concrete: 0, labor: 0, other: 0 },
      { claim: 0.2, steel: 0.02, concrete: 0, labor: 0, other: 0 },
    ],
  }));
  assert.equal(result.profit, 0.27);
  assert.equal(result.totalCosts, 0.03);
});

test('Sıfır sözleşme bedelinde kâr marjı tanımsızdır', () => {
  const result = calculate(sample({
    contractValue: 0,
    months: [{ claim: 0, steel: 0, concrete: 0, labor: 0, other: 0 }],
  }));
  assert.equal(result.margin, null);
  assert.equal(result.profit, -100);
});

test('Eksik plan, tutarsız hakediş ve geçersiz sayılar reddedilir', () => {
  assert.throws(() => calculate(sample({ months: [] })), /work plan/);
  assert.throws(() => calculate(sample({ contractValue: 3_000 })), /Total monthly billing/);
  assert.throws(() => calculate(sample({ initialCash: -1 })), /Starting cash/);
  assert.throws(() => calculate(sample({ monthlyRate: NaN })), /interest rate/);
  assert.throws(() => calculate(sample({ paymentDelay: 1.5 })), /whole months/);
});

test('Hesaplama girilen proje verisini değiştirmez', () => {
  const project = sample();
  const original = structuredClone(project);
  calculate(project);
  assert.deepEqual(project, original);
});

})();
