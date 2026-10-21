import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'wa-jeun-vercel-esm-'));
const require = createRequire(import.meta.url);
let modulesRoot = path.dirname(require.resolve('dotenv'));
while (path.basename(modulesRoot) !== 'node_modules' && path.dirname(modulesRoot) !== modulesRoot) modulesRoot = path.dirname(modulesRoot);
const graph = new Set();
const emitted = new Set();

async function collectRuntimeImports(filePath) {
  if (graph.has(filePath)) return;
  graph.add(filePath);
  const source = readFileSync(filePath, 'utf8');
  const runtimeSource = source.replace(/import\s+type\s+[\s\S]*?\sfrom\s+['"][^'"]+['"];?/g, '');
  const specifiers = [...runtimeSource.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);

  const outputPath = path.join(tempRoot, path.relative(repoRoot, filePath).replace(/\.tsx?$/, '.js'));
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const { code: js } = await transform(source, { loader: 'ts', format: 'esm', target: 'node20', sourcefile: filePath });
  writeFileSync(outputPath, js);
  emitted.add(filePath);

  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue;
    assert.match(specifier, /\.js$/, `${path.relative(repoRoot, filePath)} uses a Node-resolvable .js specifier: ${specifier}`);
    const importedSource = path.resolve(path.dirname(filePath), specifier.replace(/\.js$/, '.ts'));
    await collectRuntimeImports(importedSource);
  }
}

try {
  await collectRuntimeImports(path.join(repoRoot, 'server.ts'));
  writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ type: 'module' }));
  symlinkSync(modulesRoot, path.join(tempRoot, 'node_modules'), 'dir');
  const runnerPath = path.join(tempRoot, 'import-server.mjs');
  writeFileSync(runnerPath, `await import(${JSON.stringify(pathToFileURL(path.join(tempRoot, 'server.js')).href)});\n`);
  const result = spawnSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      VERCEL: '1',
      DOTENV_CONFIG_PATH: '/dev/null',
      SUPABASE_URL: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: ''
    }
  });
  assert.equal(result.status, 0, `Unbundled Node ESM server graph imports successfully.\n${result.stderr || result.stdout}`);
  console.log(`PASS native Node ESM import of unbundled server graph (${emitted.size} modules)`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
