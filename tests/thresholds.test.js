(() => {

function sample() {
  return {
    contractValue: 2000, initialCash: 0, monthlyOverhead: 100, monthlyRate: 0, paymentDelay: 0,
    months: Array.from({ length: 2 }, () => ({ claim: 1000, steel: 200, concrete: 100, labor: 200, other: 100 })),
  };
}

test('Demir başabaşta zarar sayılmaz; ilk zarar 150,01 artışta oluşur', () => {
  const { cost } = findThresholds(sample(), 10, 700);
  assert.equal(cost.status, 'found');
  assert.equal(cost.value, 150.01);
  assert.equal(cost.previous.profit, 0);
  assert.equal(cost.result.profit, -0.04);
});

test('Hedefe eşit marj aşım değildir; ilk düşüş beş ek ayda bulunur', () => {
  const { duration } = findThresholds(sample(), 10, 700);
  assert.equal(duration.value, 5);
  assert.equal(duration.previous.margin, 10);
  assert.equal(duration.result.margin, 5);
});

test('Kredi sınırına eşit borç aşım değildir; iki ek ay gerekir', () => {
  const { delay } = findThresholds(sample(), 10, 700);
  assert.equal(delay.value, 2);
  assert.equal(delay.previous.maxDebt, 700);
  assert.equal(delay.result.maxDebt, 1400);
});

test('Bazda aşılmış eşikler yeni eşik gibi sunulmaz', () => {
  const project = sample();
  project.monthlyOverhead = 500;
  project.paymentDelay = 1;
  const result = findThresholds(project, 10, 100);
  assert.equal(result.cost.status, 'already');
  assert.equal(result.duration.status, 'already');
  assert.equal(result.delay.status, 'already');
});

test('Demir olmayan ve genel gideri olmayan işte olmayan eşik uydurulmaz', () => {
  const project = sample();
  project.monthlyOverhead = 0;
  project.initialCash = 5000;
  project.months.forEach((month) => { month.steel = 0; });
  const result = findThresholds(project, 10, 10000);
  assert.equal(result.cost.status, 'not-found');
  assert.equal(result.duration.status, 'not-found');
  assert.equal(result.delay.status, 'not-found');
});

test('Sıfır gelirde marj tanımsız; süre araması yapılmaz', () => {
  const project = sample();
  project.contractValue = 0;
  project.months.forEach((month) => { month.claim = 0; });
  assert.equal(findThresholds(project, 10, 1000).duration.status, 'undefined');
});

test('120 ay gecikme sınırında başka ay denenmez', () => {
  const project = sample();
  project.paymentDelay = 120;
  const { delay } = findThresholds(project, 10, 5000);
  assert.deepEqual(delay, { status: 'not-found', max: 0 });
});

test('Finansmanlı eşikte komşu değerler gerçekten sınırın iki tarafındadır', () => {
  const project = sample();
  project.paymentDelay = 1;
  project.monthlyRate = 2;
  const original = structuredClone(project);
  const result = findThresholds(project, 10, 1000);
  assert.ok(result.cost.previous.profit >= 0);
  assert.ok(result.cost.result.profit < 0);
  assert.ok(result.duration.previous.margin >= 10);
  assert.ok(result.duration.result.margin < 10);
  assert.ok(result.delay.previous.maxDebt <= 1000);
  assert.ok(result.delay.result.maxDebt > 1000);
  assert.deepEqual(project, original);
});

test('Geçersiz hedefler reddedilir', () => {
  assert.throws(() => findThresholds(sample(), NaN, 1000), /margin/);
  assert.throws(() => findThresholds(sample(), 101, 1000), /margin/);
  assert.throws(() => findThresholds(sample(), 10, -1), /borrowing/);
});

test('The loss threshold follows the selected custom item', () => {
  const project = {
    items: [{ key: 'cost_transport', name: 'Transport' }],
    contractValue: 1000, initialCash: 0, monthlyOverhead: 0, monthlyRate: 0, paymentDelay: 0,
    months: [{ claim: 1000, cost_transport: 500 }],
  };
  const result = findThresholds(project, 10, 1000, 'cost_transport');
  assert.equal(result.cost.value, 100.01);
  assert.equal(result.cost.previous.profit, 0);
  assert.equal(result.cost.result.profit, -0.05);
  assert.equal(findThresholds(project, 10, 1000, 'steel').cost.status, 'empty');
});

})();
