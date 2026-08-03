const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCliArgs } = require('../service');

test('parseCliArgs extracts env vars from --env flags', () => {
  const result = parseCliArgs([
    '--env',
    'NVIDIA_API_KEY=abc123',
    '--env',
    'NVIDIA_MODEL=meta/llama-3.1-8b-instruct',
    '--install',
  ]);

  assert.deepEqual(result.env, [
    { name: 'NVIDIA_API_KEY', value: 'abc123' },
    { name: 'NVIDIA_MODEL', value: 'meta/llama-3.1-8b-instruct' },
  ]);
  assert.equal(result.action, '--install');
});
