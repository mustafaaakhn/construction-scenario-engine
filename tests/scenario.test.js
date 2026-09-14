(() => {

function sample() {
  return {
    name: 'İki aylık iş',
    contractValue: 2_000,
    initialCash: 0,
    monthlyOverhead: 100,
    monthlyRate: 0,
    paymentDelay: 0,
    months: [
      { claim: 1_000, steel: 200, concrete: 100, labor: 200, other: 100 },
      { claim: 1_000, steel: 200, concrete: 100, labor: 200, other: 100 },
    ],
  };
}

test('Sıfır değişiklik baz hesapla aynı sonucu verir ve baz veriye dokunmaz', () => {
  const project = sample();
  const original = structuredClone(project);
  const scenario = createScenario(project);
  assert.deepEqual(calculate(scenario), calculate(project));
  scenario.months[0].steel = 999;
  assert.deepEqual(project, original);
});

test('Demir %25, beton %10 ve işçilik %10 artışı kârı 160 TL azaltır', () => {
  const project = sample();
  const scenario = createScenario(project, { steel: 25, concrete: 10, labor: 10 });
  assert.equal(calculate(scenario).profit, 440);
  assert.equal(scenario.months[0].other, 100);
  assert.equal(scenario.contractValue, 2_000);
});

test('Faizsiz ek tahsilat gecikmesi yalnızca nakit ihtiyacını değiştirir', () => {
  const project = sample();
  project.paymentDelay = 1;
  const scenario = createScenario(project, { extraDelay: 1 });
  const result = calculate(scenario);
  assert.equal(scenario.paymentDelay, 2);
  assert.equal(result.rows.length, 4);
  assert.equal(result.profit, 600);
  assert.equal(result.maxDebt, 1_400);
});

test('İki ay dört aya yayılır; bütçeler korunur, genel gider iki ay artar', () => {
  const scenario = createScenario(sample(), { extraMonths: 2 });
  assert.equal(scenario.months.length, 4);
  for (const month of scenario.months) {
    assert.deepEqual(month, { claim: 500, steel: 100, concrete: 50, labor: 100, other: 50 });
  }
  assert.equal(calculate(scenario).profit, 400);
});

test('Dengesiz plan üç aya yayılırken erken giderlerin sırası korunur', () => {
  const project = sample();
  project.months[0] = { claim: 300, steel: 90, concrete: 0, labor: 0, other: 0 };
  project.months[1] = { claim: 1_700, steel: 0, concrete: 0, labor: 0, other: 0 };
  const scenario = createScenario(project, { extraMonths: 1 });
  assert.deepEqual(scenario.months.map((month) => month.claim), [200, 666.67, 1_133.33]);
  assert.deepEqual(scenario.months.map((month) => month.steel), [60, 30, 0]);
  assert.equal(calculate(scenario).profit, 1_610);
});

test('Kuruşlu bütçeler farklı uzama miktarlarında eksiksiz korunur', () => {
  const project = sample();
  project.contractValue = 0.03;
  project.months = [
    { claim: 0.01, steel: 0.02, concrete: 0.03, labor: 0.01, other: 0.01 },
    { claim: 0.02, steel: 0.01, concrete: 0.01, labor: 0.02, other: 0.02 },
  ];
  for (const extraMonths of [1, 3, 11, 118]) {
    const scenario = createScenario(project, { extraMonths });
    for (const key of ['claim', 'steel', 'concrete', 'labor', 'other']) {
      const total = (months) => months.reduce((sum, month) => sum + Math.round(month[key] * 100), 0);
      assert.equal(total(scenario.months), total(project.months));
      assert.ok(scenario.months.every((month) => month[key] >= 0));
    }
    assert.doesNotThrow(() => calculate(scenario));
  }
});

test('Birleşik stres: %25 demir, %10 işçilik, bir ay gecikme ve iki ay uzama', () => {
  const project = sample();
  project.monthlyRate = 10;
  const result = calculate(createScenario(project, { steel: 25, labor: 10, extraDelay: 1, extraMonths: 2 }));
  // Aylık gider 435 TL; açılış borcu faizleri 43,50 + 41,35 + 38,99 + 36,38 TL.
  assert.equal(result.totalCosts, 1_740);
  assert.equal(result.financeCost, 160.22);
  assert.equal(result.profit, 99.78);
  assert.equal(result.maxDebt, 435);
  assert.equal(result.rows.length, 5);
});

test('Maliyet düşüşü desteklenir; %-100 ilgili maliyeti sıfırlar', () => {
  const result = calculate(createScenario(sample(), { steel: -100, labor: -50 }));
  assert.equal(result.profit, 1_200);
});

test('Zararlı işte son tahsilattan sonra kalan borç görünür', () => {
  const project = sample();
  const result = calculate(createScenario(project, { steel: 200 }));
  assert.equal(result.profit, -200);
  assert.equal(result.finalBalance, -200);
});

test('Geçersiz değişimler ve toplam süre sınırları kontrol edilir', () => {
  const project = sample();
  assert.throws(() => createScenario(project, { steel: -101 }), /Steel/);
  assert.throws(() => createScenario(project, { labor: NaN }), /Labour/);
  assert.throws(() => createScenario(project, { extraMonths: 1.5 }), /whole months/);
  assert.throws(() => createScenario(project, { extraMonths: 119 }), /120/);
  project.paymentDelay = 120;
  assert.throws(() => createScenario(project, { extraDelay: 1 }), /120/);
  assert.throws(() => createScenario(project, { extraDelay: -1 }), /whole months/);
});

test('Custom items affect profit and keep their budget when the plan stretches', () => {
  const project = {
    items: [{ key: 'cost_transport', name: 'Transport' }, { key: 'cost_tools', name: 'Tools' }],
    contractValue: 1000, initialCash: 0, monthlyOverhead: 0, monthlyRate: 0, paymentDelay: 0,
    months: [{ claim: 1000, cost_transport: 100.01, cost_tools: 50.03 }],
  };
  const original = structuredClone(project);
  const changed = createScenario(project, { cost_transport: 20, extraMonths: 2 });
  assert.equal(calculate(project).profit, 849.96);
  assert.equal(calculate(changed).profit, 829.96);
  assert.equal(Math.round(changed.months.reduce((sum, month) => sum + month.cost_tools, 0) * 100), 5003);
  assert.deepEqual(project, original);
  assert.throws(() => createScenario(project, { cost_transport: -101 }), /Transport/);
});

test('Removed items and their old scenario changes no longer affect the calculation', () => {
  const project = {
    items: [], contractValue: 1000, initialCash: 0, monthlyOverhead: 100, monthlyRate: 0, paymentDelay: 0,
    months: [{ claim: 1000, steel: 500 }],
  };
  assert.equal(calculate(createScenario(project, { steel: 50, extraMonths: 1 })).profit, 800);
});

})();
