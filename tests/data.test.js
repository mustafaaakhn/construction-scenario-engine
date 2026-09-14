(() => {

function draft() {
  return {
    app: 'construction-scenario-engine', version: 1,
    fields: { name: 'Konut projesi', contractValue: '600.000,50', initialCash: '', monthlyOverhead: '10.000', monthlyRate: '2', paymentDelay: '1', duration: '1' },
    scenario: { steel: '20', concrete: '0', labor: '15', extraDelay: '2', extraMonths: '4' },
    months: [{ claim: '600.000,50', steel: '150.000', concrete: '100.000', labor: '10.000,', other: '' }],
  };
}

test('Para girişi yazılırken binlik noktalara ayrılır', () => {
  assert.equal(formatAmount('600000'), '600.000');
  assert.equal(formatAmount('600.0000'), '6.000.000');
  assert.equal(formatAmount('001000'), '1.000');
  assert.equal(formatAmount('25000,75'), '25.000,75');
  assert.equal(formatAmount(',5'), '0,5');
});

test('Kuruş yazarken virgül ve sondaki sıfır kaybolmaz', () => {
  assert.equal(formatAmount('1000,'), '1.000,');
  assert.equal(formatAmount('1000,50'), '1.000,50');
  assert.equal(formatAmount(''), '');
  assert.equal(readAmount('1.000,50'), 1000.5);
  assert.equal(readAmount('1.000,'), 1000);
});

test('Geçersiz tutarlar sessizce pozitif sayıya veya sıfıra dönüşmez', () => {
  for (const value of ['', '-500', 'abc', '1,234', '1,2,3', 'Infinity', '1.000.000.000.001']) {
    assert.ok(Number.isNaN(readAmount(value)));
  }
  assert.equal(formatAmount('-500'), '-500');
  assert.equal(formatAmount('1,234'), '1,234');
});

test('Sayı gösterimi ve geri okuma hesap değerini korur', () => {
  for (const value of [0, 0.01, 25000.75, 600000, 999999999999.99, 1_000_000_000_000]) {
    assert.equal(readAmount(displayAmount(value)), value);
  }
});

test('Kayıt turunda eksik alan, kuruş taslağı ve senaryo korunur', () => {
  const data = draft();
  assert.deepEqual(readSave(JSON.stringify(data)), data);
});

test('Bozuk veya başka bir uygulamaya ait JSON reddedilir', () => {
  assert.throws(() => readSave('{bozuk'), /JSON/);
  assert.throws(() => readSave('null'), /not a project/);
  assert.throws(() => readSave(JSON.stringify({ ...draft(), version: 99 })), /unsupported/);
  assert.throws(() => readSave(JSON.stringify({ ...draft(), app: 'other' })), /not a project/);
});

test('Eksik alanlar ve plan boyutu kontrol edilir', () => {
  const data = draft();
  delete data.scenario.labor;
  assert.throws(() => readSave(JSON.stringify(data)), /missing/);
  assert.throws(() => readSave(JSON.stringify({ ...draft(), months: [] })), /1–120/);
  assert.throws(() => readSave(JSON.stringify({ ...draft(), months: Array(121).fill(draft().months[0]) })), /1–120/);
  assert.throws(() => readSave(' '.repeat(1_000_001)), /1 MB/);
});

test('Boş süre taslağı açılır; geçerli süre ile planın tutarsızlığı reddedilir', () => {
  const data = draft();
  data.fields.duration = '';
  assert.equal(readSave(JSON.stringify(data)).fields.duration, '');
  data.fields.duration = '2';
  assert.throws(() => readSave(JSON.stringify(data)), /does not match/);
});

 test('İmleç binlik ayraçta, baştaki sıfırda ve virgülde doğru yerde kalır', () => {
  for (const [value, position, expectedValue, expectedCursor] of [
    ['6000', 4, '6.000', 5],
    ['1239456', 4, '1.239.456', 5],
    [',', 1, '0,', 2],
    ['05', 2, '5', 1],
  ]) {
    const field = { value, selectionStart: position, setCustomValidity() {}, setSelectionRange(start) { this.cursor = start; } };
    updateAmount(field);
    assert.equal(field.value, expectedValue);
    assert.equal(field.cursor, expectedCursor);
  }
});

 test('Eski kayıtlar açılır; yeni eşik hedefleri dosyada korunur', () => {
  const old = draft();
  assert.deepEqual(readSave(JSON.stringify(old)), old);
  const data = { ...old, limits: { margin: '12.5', credit: '2.500.000,50' } };
  assert.deepEqual(readSave(JSON.stringify(data)), data);
  assert.throws(() => readSave(JSON.stringify({ ...old, limits: { margin: 10 } })), /invalid/);
});

test('İsimli senaryolar, taslak ve eşikler birlikte kaydedilip açılır', () => {
  const data = {
    ...draft(),
    scenarioName: 'Yeni kombinasyon',
    scenarios: [
      { name: 'Demir artışı', changes: { steel: 20, concrete: 0, labor: 0, extraDelay: 0, extraMonths: 0 } },
      { name: 'Demir + işçilik', changes: { steel: 20, concrete: 0, labor: 15, extraDelay: 0, extraMonths: 0 } },
    ],
    limits: { margin: '10', credit: '1.000.000' },
  };
  const restored = readSave(JSON.stringify(data));
  assert.deepEqual(restored, data);
  restored.scenario.steel = '99';
  assert.equal(restored.scenarios[0].changes.steel, 20);
  restored.scenarios[1].changes.labor = 30;
  assert.equal(restored.scenarios[0].changes.labor, 0);
  restored.scenarios.splice(0, 1);
  assert.equal(readSave(JSON.stringify(restored)).scenarios[0].name, 'Demir + işçilik');
});

test('Bozuk senaryo listesi ve sınır dışı koşullar reddedilir', () => {
  const item = { name: 'Demir', changes: { steel: 20, concrete: 0, labor: 0, extraDelay: 0, extraMonths: 0 } };
  for (const scenarios of [null, {}, [null], Array(4).fill(item), [{ ...item, name: ' ' }], [{ ...item, name: 'x'.repeat(61) }]]) {
    assert.throws(() => readSave(JSON.stringify({ ...draft(), scenarios })), /scenario/i);
  }
  for (const changes of [{}, { ...item.changes, steel: '20' }, { ...item.changes, steel: -101 }, { ...item.changes, labor: 1001 }, { ...item.changes, extraDelay: 0.5 }, { ...item.changes, extraMonths: 120 }]) {
    assert.throws(() => readSave(JSON.stringify({ ...draft(), scenarios: [{ ...item, changes }] })), /changes are invalid/);
  }
});

test('Aynı isimli senaryolar ve Baz adı karışıklık oluşturmadan reddedilir', () => {
  const item = { name: 'Demir', changes: { steel: 0, concrete: 0, labor: 0, extraDelay: 0, extraMonths: 0 } };
  for (const scenarios of [[item, { ...item, name: ' DEMİR ' }], [{ ...item, name: 'Baz' }]]) {
    assert.throws(() => readSave(JSON.stringify({ ...draft(), scenarios })), /names/);
  }
  assert.throws(() => readSave(JSON.stringify({ ...draft(), scenarioName: 12 })), /Scenario names/);
  assert.deepEqual(readSave(JSON.stringify({ ...draft(), scenarios: [] })).scenarios, []);
});

test('Custom items, unfinished amounts and scenario changes survive a file round trip', () => {
  const data = {
    ...draft(),
    items: [{ key: 'cost_transport', name: 'Nakliye' }],
    months: [{ claim: '600.000,50', cost_transport: '25.000,' }],
    scenario: { cost_transport: '20', extraDelay: '0', extraMonths: '0' },
    scenarios: [{ name: 'Transport rise', changes: { cost_transport: 20, extraDelay: 0, extraMonths: 0 } }],
  };
  assert.deepEqual(readSave(JSON.stringify(data)), data);
  for (const items of [[{ key: 'claim', name: 'Bad' }], [data.items[0], data.items[0]], [{ key: 'cost_a', name: '' }]]) {
    assert.throws(() => readSave(JSON.stringify({ ...data, items })), /invalid cost items/);
  }
  delete data.months[0].cost_transport;
  assert.throws(() => readSave(JSON.stringify(data)), /missing or invalid/);
});

test('A project can be saved with all cost items removed', () => {
  const data = { ...draft(), items: [], months: [{ claim: '600.000,50' }], scenario: { extraDelay: '0', extraMonths: '0' } };
  assert.deepEqual(readSave(JSON.stringify(data)), data);
});

})();
