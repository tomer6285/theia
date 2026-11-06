const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const fromMobile = createRequire(path.resolve(__dirname, '../apps/mobile/package.json'));
const fromExpo = createRequire(fromMobile.resolve('expo/package.json'));

test('Expo can create and extract archives with patched tar', async () => {
  const fromCli = createRequire(fromExpo.resolve('@expo/cli/package.json'));
  const tar = fromCli('tar');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'theia-archive-'));
  try {
    await fs.mkdir(path.join(directory, 'output'));
    await fs.writeFile(path.join(directory, 'fixture.txt'), 'Theia');
    await tar.create({ cwd: directory, file: path.join(directory, 'fixture.tar') }, ['fixture.txt']);
    await tar.extract({ cwd: path.join(directory, 'output'), file: path.join(directory, 'fixture.tar') });
    assert.equal(await fs.readFile(path.join(directory, 'output/fixture.txt'), 'utf8'), 'Theia');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('Expo plist serialization and parsing work with patched xmldom', () => {
  const fromPlugins = createRequire(fromExpo.resolve('@expo/config-plugins/package.json'));
  const plist = fromPlugins('@expo/plist').default;
  const original = { name: 'Theia', enabled: true, count: 42, list: ['one', 'two'] };
  assert.deepEqual(plist.parse(plist.build(original)), original);
});

test('Expo Router query parsing works with the patched ESM decoder', () => {
  const fromRouter = createRequire(fromMobile.resolve('expo-router/package.json'));
  const query = fromRouter('query-string');
  const original = { q: 'Theia & more', list: ['one', 'two'], empty: '' };
  assert.deepEqual({ ...query.parse(query.stringify(original)) }, original);
  assert.doesNotThrow(() => query.parse('q=' + '%E0%A4%A'.repeat(1000)));
});
