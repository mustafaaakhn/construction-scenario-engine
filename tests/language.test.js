(() => {

test('Dil değişimi sonuçları değiştirmez ve hata mesajlarını çevirir', () => {
  setLanguage('en');
  const before = calculate(sampleProject);
  assert.equal(t('Month {0}', 2), 'Month 2');
  try {
    setLanguage('tr');
    assert.deepEqual(calculate(sampleProject), before);
    assert.equal(t('Month {0}', 2), '2. ay');
    assert.throws(() => calculate({ ...sampleProject, initialCash: -1 }), /Başlangıç nakdi/);
    assert.equal(t('Remove {0}', '<Özel isim>'), '<Özel isim> senaryosunu sil');
  } finally {
    setLanguage('en');
  }
});

test('Dil seçimi kaydedilir; eski dosyalar desteklenir', () => {
  const data = {
    app: 'construction-scenario-engine', version: 1,
    fields: { name: 'Project', contractValue: '100', initialCash: '0', monthlyOverhead: '0', monthlyRate: '0', paymentDelay: '0', duration: '1' },
    scenario: { steel: '0', concrete: '0', labor: '0', extraDelay: '0', extraMonths: '0' },
    months: [{ claim: '100', steel: '10', concrete: '10', labor: '10', other: '10' }],
  };
  for (const language of ['en', 'tr']) {
    assert.deepEqual(readSave(JSON.stringify({ ...data, language })), { ...data, language });
  }
  assert.deepEqual(readSave(JSON.stringify(data)), data);
  assert.throws(() => readSave(JSON.stringify({ ...data, language: 'de' })), /Language/);
});

})();
