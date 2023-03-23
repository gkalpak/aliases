// Imports
import {readFileSync} from 'node:fs';
import {join, resolve as pathResolve} from 'node:path';
import {fileURLToPath} from 'node:url';


// Constants
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = pathResolve(__dirname, '..');

// Exports
export {
  ROOT_DIR,
  loadPackageJson,
};

// Helpers
function loadPackageJson() {
  const pkgJsonPath = join(ROOT_DIR, 'package.json');
  return JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
}
