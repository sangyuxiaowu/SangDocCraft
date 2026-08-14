const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const pkg = readJson(pkgPath);
const version = pkg.version;
if (!version) {
  console.error('Missing package.json version.');
  process.exit(1);
}

const tauriConf = readJson(tauriConfPath);
if (tauriConf.version !== version) {
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
}

let cargoToml = fs.readFileSync(cargoPath, 'utf8');
const nextCargoToml = cargoToml.replace(/^(version\s*=\s*")([^"]+)("\s*)$/m, `$1${version}$3`);
if (nextCargoToml !== cargoToml) {
  fs.writeFileSync(cargoPath, nextCargoToml);
}

console.log(`Synced Tauri versions to ${version}`);
