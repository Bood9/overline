/**
 * Set or change the app password.
 *   npm run set-password            — asks for it (input hidden)
 *   npm run set-password -- --random — generates a strong one and prints it once
 * Stores only a scrypt hash in .env.local. Changing it logs out every device.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { hashPassword } from '../src/lib/auth/session';

const ENV = path.join(process.cwd(), '.env.local');

function upsert(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as any;
    out._writeToOutput = (s: string) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

function randomPassword(): string {
  // 4 groups of 4 from an unambiguous alphabet: ~80 bits
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

async function main() {
  let password: string;
  if (process.argv.includes('--random')) {
    password = randomPassword();
  } else {
    password = await ask('New password: ');
    const again = await ask('Repeat: ');
    if (password !== again) { console.error('Passwords do not match.'); process.exit(1); }
  }
  if (password.length < 8) { console.error('At least 8 characters required.'); process.exit(1); }

  let env = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  env = upsert(env, 'APP_PASSWORD_HASH', hashPassword(password));
  if (!/^AUTH_SECRET=.{32,}$/m.test(env)) env = upsert(env, 'AUTH_SECRET', crypto.randomBytes(32).toString('base64url'));
  if (/^CRON_SECRET=(change-me)?\s*$/m.test(env)) env = upsert(env, 'CRON_SECRET', crypto.randomBytes(24).toString('base64url'));
  fs.writeFileSync(ENV, env, { mode: 0o600 });
  fs.chmodSync(ENV, 0o600);

  if (process.argv.includes('--random')) console.log(`Password: ${password}`);
  console.log('Done. Stored as a scrypt hash in .env.local; every existing session is now invalid.');
  console.log('Restart the server to pick up the change.');
}
main();
