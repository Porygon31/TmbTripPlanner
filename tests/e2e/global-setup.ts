import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Construit le catalogue de test à partir des GPX synthétiques (et vérifie que le build existe). */
export default function globalSetup() {
  execSync('npx tsx scripts/build-catalog.ts --src tests/fixtures/data --out tests/.generated/data', { stdio: 'inherit' });
  if (!existsSync('dist/index.html')) {
    throw new Error('Build absent : lancez `npm run build` avant les tests E2E.');
  }
}
