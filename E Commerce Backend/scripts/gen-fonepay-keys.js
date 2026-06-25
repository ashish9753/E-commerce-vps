// Generate the RSA 2048 key pair Fonepay requires for request signing.
//
//   node scripts/gen-fonepay-keys.js          # generate (won't overwrite an existing key)
//   node scripts/gen-fonepay-keys.js --force   # regenerate even if one exists
//
// - Writes the PRIVATE key into .env (FONEPAY_PRIVATE_KEY) — keep it secret.
// - Writes the PUBLIC key to fonepay_public_key.pem — send THIS to Fonepay.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", ".env");
const PUB_PATH = path.resolve(__dirname, "..", "fonepay_public_key.pem");

const force = process.argv.includes("--force");

// Guard: don't silently replace a key that may already be registered with Fonepay.
const env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
const lineExists = /^FONEPAY_PRIVATE_KEY=.*$/m.test(env);
const existing = env.match(/^FONEPAY_PRIVATE_KEY=(.+)$/m);
if (existing && existing[1].trim() && existing[1].trim() !== '""' && !force) {
  console.log("⚠️  FONEPAY_PRIVATE_KEY already has a value in .env.");
  console.log("   If Fonepay already registered your public key, DO NOT regenerate.");
  console.log("   To replace it anyway, run:  node scripts/gen-fonepay-keys.js --force");
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding:  { type: "spki",  format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Store the private key in .env as a single line with \n escapes (the service
// un-escapes it at load time).
const escaped = privateKey.trim().replace(/\n/g, "\\n");
const line = `FONEPAY_PRIVATE_KEY="${escaped}"`;
const newEnv = lineExists
  ? env.replace(/^FONEPAY_PRIVATE_KEY=.*$/m, line)
  : env.replace(/\n*$/, "\n") + line + "\n";
fs.writeFileSync(ENV_PATH, newEnv);

// Save the public key for sharing.
fs.writeFileSync(PUB_PATH, publicKey.trim() + "\n");

console.log("✅ RSA 2048 key pair generated.");
console.log("   • Private key written to .env (FONEPAY_PRIVATE_KEY) — keep secret.");
console.log(`   • Public key written to ${PUB_PATH}`);
console.log("\n──────── SEND THIS PUBLIC KEY TO FONEPAY ────────\n");
console.log(publicKey.trim());
console.log("\n─────────────────────────────────────────────────");
