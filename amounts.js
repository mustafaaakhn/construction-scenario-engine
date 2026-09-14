function formatAmount(value) {
  const text = String(value).replace(/\s/g, '').replace(/\./g, '');
  if (text === '' || !/^\d*(,\d{0,2})?$/.test(text)) return String(value);
  const [whole, fraction] = text.split(',');
  const digits = (whole || '0').replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

function readAmount(value) {
  const text = String(value).replace(/\s/g, '').replace(/\./g, '');
  if (!/^\d+(,\d{0,2})?$/.test(text)) return NaN;
  const amount = Number(text.replace(',', '.'));
  return Number.isFinite(amount) && amount <= 1_000_000_000_000 ? amount : NaN;
}

function displayAmount(value) {
  return typeof value === 'number'
    ? value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
    : formatAmount(value);
}

function updateAmount(field) {
  const before = field.value;
  const position = field.selectionStart ?? before.length;
  const clean = (text) => text.replace(/[.\s]/g, '');
  field.value = formatAmount(before);
  const left = Math.max(0, clean(before.slice(0, position)).length + clean(field.value).length - clean(before).length);
  field.setCustomValidity(field.value !== '' && Number.isNaN(readAmount(field.value))
    ? t('Enter an amount from 0 to 1.000.000.000.000. Use a comma and up to two digits for cents.') : '');

  // Eklenen binlik noktaları, yazı imlecini rakamların arasında kaydırmasın.
  let cursor = 0;
  let count = 0;
  while (cursor < field.value.length && count < left) {
    if (field.value[cursor] !== '.') count++;
    cursor++;
  }
  field.setSelectionRange(cursor, cursor);
}
