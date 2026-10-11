const p = 'D:\Proyectos\DynaRent\.tmp-release\release.yml';
const lines = require('fs').readFileSync(p, 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('name: Verificar que la clave de firma coincide con la pubkey'));
if (start < 0) { console.log('NO SE ENCONTRÓ EL PASO'); process.exit(1); }
let end = -1;
for (let i = start; i < lines.length; i++) {
  if (lines[i].includes('node scripts/verificar-pubkey-updater.mjs')) { end = i; break; }
}
if (end < 0) { console.log('NO SE ENCONTRÓ FIN DE BLOQUE'); process.exit(1); }
console.log('start', start, 'end', end);
const newBlock = [
  "       - name: Verificar que la clave de firma coincide con la pubkey de tauri.conf.json",
  "         shell: bash",
  "         env:",
  "           TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}",
  "         run: |",
  "           set -euo pipefail",
  "           KEY_FILE=\"$RUNNER_TEMP/firma.key\"",
  "           PAYLOAD=\"$RUNNER_TEMP/payload-guard.txt\"",
  "           printf '%s\n' \"${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}\" > \"$KEY_FILE\"",
  "           printf 'guard-pubkey-updater\n' > \"$PAYLOAD\"",
  "           unset TAURI_SIGNING_PRIVATE_KEY",
  "           bunx tauri signer sign -f \"$KEY_FILE\" -p \"${{ env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}\" \"$PAYLOAD\"",
  "           node scripts/verificar-pubkey-updater.mjs \"$PAYLOAD.sig\"",
];
lines.splice(start, end - start + 1, ...newBlock);
require('fs').writeFileSync(p, lines.join('\n'), 'utf8');
console.log('editado');
