// scripts/verificar-pubkey-updater.mjs — Guard del auto-updater.
//
// Compara el key ID de un `.sig` de Tauri (firmado con la clave privada real)
// con la `plugins.updater.pubkey` embebida en `src-tauri/tauri.conf.json`.
//
// Si no coinciden, TODAS las apps instaladas rechazan la release con
// "The signature was created with a different key than the one provided"
// (pasó con las builds ≤1.2.4: pubkey 4BB969BC7B0ED52F vs firma 73F96EF7F5E69FCE).
// Se ejecuta en `release.yml` ANTES de publicar, para fallar el job a tiempo.
//
// Uso:
//   node scripts/verificar-pubkey-updater.mjs <archivo.sig>
//   (también acepta la pubkey directa: ... --pubkey "<base64>")
//
// Códigos de salida: 0 = coincide · 1 = NO coincide o datos inválidos · 2 = uso
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const sigPath = args.find((a) => !a.startsWith('--'));
const pubkeyArgIdx = args.indexOf('--pubkey');
const pubkeyFromArg = pubkeyArgIdx !== -1 ? args[pubkeyArgIdx + 1] : undefined;

if (!sigPath && !pubkeyFromArg) {
	console.error('uso: node scripts/verificar-pubkey-updater.mjs <archivo.sig> [--pubkey <base64>]');
	process.exit(2);
}

/** Key ID en formato "texto" (como lo imprime minisign en la pubkey). */
function keyIdDesdePubkeyBase64(base64) {
	const texto = Buffer.from(base64, 'base64').toString('utf8');
	const m = texto.match(/minisign public key:\s*([0-9a-fA-F]+)/);
	if (!m) return null;
	return m[1].toUpperCase();
}

/** Key ID en el mismo formato a partir de un .sig de Tauri. */
function keyIdDesdeSig(path) {
	const crudo = readFileSync(path, 'utf8').replace(/\s+/g, '');
	const texto = Buffer.from(crudo, 'base64').toString('utf8');
	const linea = texto.split('\n').filter(Boolean).find((l) => !l.includes('comment:'));
	if (!linea) return null;
	const raw = Buffer.from(linea, 'base64');
	// estructura: alg(2) + key_id(8) + firma(64) = 74 bytes (Ed25519)
	if (raw.length !== 74) return null;
	// minisign imprime el key_id en orden inverso al de la estructura
	return Buffer.from(raw.subarray(2, 10)).reverse().toString('hex').toUpperCase();
}

// 1) pubkey embebida en la app (la que usarán todas las instalaciones)
let pubkeyBase64 = pubkeyFromArg;
if (!pubkeyBase64) {
	const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
	pubkeyBase64 = conf?.plugins?.updater?.pubkey;
	if (!pubkeyBase64) {
		console.error('❌ tauri.conf.json no define plugins.updater.pubkey');
		process.exit(1);
	}
}
const confKeyId = keyIdDesdePubkeyBase64(pubkeyBase64);
if (!confKeyId) {
	console.error('❌ No se pudo leer el key ID de la pubkey de tauri.conf.json');
	process.exit(1);
}

// 2) key ID de la firma real
if (pubkeyFromArg && !sigPath) {
	console.log(`pubkey de tauri.conf.json → key ID ${confKeyId}`);
	process.exit(0);
}
const sigKeyId = keyIdDesdeSig(sigPath);
if (!sigKeyId) {
	console.error(`❌ Formato de .sig inválido o distinto de Ed25519: ${sigPath}`);
	process.exit(1);
}

console.log(`pubkey en tauri.conf.json : ${confKeyId}`);
console.log(`clave que firma (${sigPath}) : ${sigKeyId}`);

if (confKeyId !== sigKeyId) {
	console.error('');
	console.error('❌ MISMATCH: la clave que firma NO corresponde a la pubkey embebida.');
	console.error('   Las apps instaladas rechazarán esta release con:');
	console.error('   "The signature was created with a different key than the one provided".');
	console.error('   Revisa el secret TAURI_SIGNING_PRIVATE_KEY y la pubkey en tauri.conf.json');
	console.error('   (ver SECRET_FIRMA_UPDATER.md).');
	process.exit(1);
}

console.log('✅ Coinciden: la release será válida para todas las instalaciones.');
