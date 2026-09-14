const storageKey = 'insaat-hesap-project';

function readSave(text) {
  if (text.length > 1_000_000) throw new Error(t('The project file must be no larger than 1 MB.'));
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('Could not read this file. Choose a valid JSON project file.'));
  }
  if (data?.app !== 'construction-scenario-engine' || data.version !== 1) {
    throw new Error(t('This is not a project from this calculator, or the file format is unsupported.'));
  }

  function readFields(values, keys) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error(t('The project file has missing fields.'));
    }
    const result = {};
    for (const key of keys) {
      if (typeof values[key] !== 'string' || values[key].length > 100) {
        throw new Error(t('The project file has missing or invalid fields.'));
      }
      result[key] = values[key];
    }
    return result;
  }

  if (!Array.isArray(data.months) || data.months.length < 1 || data.months.length > 120) {
    throw new Error(t('The project file must contain a plan of 1–120 months.'));
  }
  const fields = readFields(data.fields, ['name', 'contractValue', 'initialCash', 'monthlyOverhead', 'monthlyRate', 'paymentDelay', 'duration']);
  const duration = Number(fields.duration);
  if (Number.isInteger(duration) && duration >= 1 && duration <= 120 && duration !== data.months.length) {
    throw new Error(t('Work duration does not match the monthly plan in the file.'));
  }
  if (data.currency !== undefined && !['EUR', 'USD', 'TL'].includes(data.currency)) {
    throw new Error(t('Currency must be EUR, USD or TL.'));
  }
  if (data.language !== undefined && !['en', 'tr'].includes(data.language)) {
    throw new Error(t('Language must be English or Turkish.'));
  }
  const items = data.items === undefined ? defaultItems : data.items;
  if (!Array.isArray(items) || items.some((item) =>
    !item || typeof item.key !== 'string' || !/^(steel|concrete|labor|other|cost_[a-z0-9-]+)$/.test(item.key)
    || item.key.length > 60 || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 40)
    || new Set(items.map((item) => item.key)).size !== items.length) {
    throw new Error(t('The project file has invalid cost items.'));
  }
  const costKeys = items.map((item) => item.key);
  const scenarioKeys = [...(data.items === undefined ? ['steel', 'concrete', 'labor'] : costKeys), 'extraDelay', 'extraMonths'];
  let scenarios;
  if (data.scenarios !== undefined) {
    if (!Array.isArray(data.scenarios) || data.scenarios.length > 3) {
      throw new Error(t('A project can have up to 3 scenarios.'));
    }
    scenarios = data.scenarios.map((item) => {
      if (typeof item?.name !== 'string' || !item.name.trim() || item.name.length > 60) {
        throw new Error(t('Scenario names must be 1–60 characters long.'));
      }
      const changes = {};
      for (const key of scenarioKeys) {
        const value = item.changes?.[key];
        const isMonth = key === 'extraDelay' || key === 'extraMonths';
        if (!Number.isFinite(value) || (isMonth
          ? !Number.isInteger(value) || value < 0 || value > (key === 'extraMonths' ? 119 : 120)
          : value < -100 || value > 1000)) {
          throw new Error(t('Saved scenario changes are invalid.'));
        }
        changes[key] = value;
      }
      return { name: item.name.trim(), changes };
    });
    const names = scenarios.map((item) => item.name.toLocaleLowerCase('tr-TR'));
    if (new Set(names).size !== names.length || names.includes('baz') || names.includes('base')) {
      throw new Error(t('Scenario names must differ from each other and from Base.'));
    }
  }
  if (data.scenarioName !== undefined && (typeof data.scenarioName !== 'string' || data.scenarioName.length > 60)) {
    throw new Error(t('Scenario names must be no longer than 60 characters.'));
  }
  return {
    app: data.app,
    version: 1,
    fields,
    ...(data.items === undefined ? {} : { items }),
    ...(data.language === undefined ? {} : { language: data.language }),
    ...(data.currency === undefined ? {} : { currency: data.currency }),
    ...(scenarios === undefined ? {} : { scenarios }),
    ...(data.scenarioName === undefined ? {} : { scenarioName: data.scenarioName }),
    ...(data.limits === undefined ? {} : { limits: readFields(data.limits, ['margin', 'credit']) }),
    scenario: readFields(data.scenario, scenarioKeys),
    months: data.months.map((month) => readFields(month, ['claim', ...costKeys])),
  };
}
