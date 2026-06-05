const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirs = new Set(['node_modules']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path.join(dir, entry.name));
    }
  }
}

walk(root);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Sintaxe OK em ${files.length} arquivo(s).`);
