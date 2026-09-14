const output = document.querySelector('#checks');
let passed = 0;
let failed = 0;

function same(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}

const assert = {
  doesNotThrow(action) {
    action();
  },
  equal(actual, expected) {
    if (!Object.is(actual, expected)) throw new Error(`Expected ${expected}, got ${actual}`);
  },
  deepEqual(actual, expected) {
    if (!same(actual, expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  },
  ok(value) {
    if (!value) throw new Error('Expected a true value');
  },
  throws(action, pattern) {
    try { action(); } catch (error) {
      if (pattern && !pattern.test(error.message)) throw error;
      return;
    }
    throw new Error('Expected an error');
  },
};

function test(name, check) {
  const row = document.createElement('li');
  try {
    check();
    passed++;
    row.textContent = `✓ ${name}`;
  } catch (error) {
    failed++;
    row.textContent = `✗ ${name}: ${error.message}`;
    row.style.color = '#a63a27';
  }
  output.append(row);
  document.querySelector('#summary').textContent = `${passed} passed, ${failed} failed`;
}
