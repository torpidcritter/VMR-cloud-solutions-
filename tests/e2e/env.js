// Shared settings for the browser tests. See tests/e2e/README.md.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const B = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SHOTS = process.env.E2E_SHOTS || path.join(ROOT, 'shots');
const FIX = path.join(ROOT, 'tests/fixtures');
const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), 'vmr-e2e');
const SERVER_LOG = process.env.E2E_SERVER_LOG || path.join(OUT, 'server.log');
for (const d of [path.join(SHOTS, 'admin'), path.join(SHOTS, 'hardening'), OUT]) fs.mkdirSync(d, { recursive: true });

// Checks that must hold. Each is printed; any that fails makes the script exit with an error.
const failures = [];
function ok(label, actual, expected = true) {
  const pass = typeof expected === 'function' ? expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${typeof actual === 'string' ? actual : JSON.stringify(actual)}`);
  if (!pass) failures.push(label);
  return pass;
}
process.on('exit', (code) => {
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed: ${failures.join('; ')}`);
    if (code === 0) process.exitCode = 1;
  }
});

module.exports = { B, SHOTS, FIX, OUT, SERVER_LOG, ok };
