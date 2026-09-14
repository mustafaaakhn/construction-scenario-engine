function stretchPlan(months, duration, items) {
  const count = months.length;
  const keys = ['claim', ...items.map((item) => item.key)];
  const plan = Array.from({ length: duration }, () => Object.fromEntries(keys.map((key) => [key, 0])));

  for (let i = 0; i < count; i++) {
    const start = i * duration;
    const end = (i + 1) * duration;
    for (const key of keys) {
      const cents = Math.round(months[i][key] * 100);
      let allocated = 0;
      // Her eski ay yeni takvimde uzar. Birikimli yuvarlama kuruş kaybını önler.
      for (let j = Math.floor(start / count); j < Math.ceil(end / count); j++) {
        const fraction = (Math.min(end, (j + 1) * count) - start) / duration;
        const share = Math.round(cents * fraction);
        plan[j][key] += share - allocated;
        allocated = share;
      }
    }
  }

  return plan.map((month) => Object.fromEntries(keys.map((key) => [key, month[key] / 100])));
}

function createScenario(project, changes = {}) {
  const { extraDelay = 0, extraMonths = 0 } = changes;
  const items = getItems(project);
  for (const item of items) {
    const rate = changes[item.key] ?? 0;
    if (!Number.isFinite(rate) || rate < -100 || rate > 1000) {
      throw new Error(t("{0} change must be between -100% and 1000%.", itemName(item)));
    }
  }
  if (!Number.isInteger(extraMonths) || extraMonths < 0 || project.months.length + extraMonths > 120) {
    throw new Error(t('Extra time must be zero or positive whole months; total work duration cannot exceed 120 months.'));
  }
  if (!Number.isInteger(extraDelay) || extraDelay < 0 || project.paymentDelay + extraDelay > 120) {
    throw new Error(t('Extra delay must be zero or positive whole months; total payment delay cannot exceed 120 months.'));
  }

  const months = project.months.map((month) => {
    const updated = { ...month };
    for (const { key } of items) {
      const rate = changes[key] ?? 0;
      updated[key] = Math.round(Math.round(month[key] * 100) * (1 + rate / 100)) / 100;
    }
    return updated;
  });

  return {
    ...project,
    paymentDelay: project.paymentDelay + extraDelay,
    months: extraMonths === 0 ? months : stretchPlan(months, months.length + extraMonths, items),
  };
}
