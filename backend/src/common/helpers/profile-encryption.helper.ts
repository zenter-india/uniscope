import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM encrypt/decrypt for `UserProfile.realNameEncrypted` — the one
 * field in this schema that's genuinely reversible-sensitive (unlike
 * phoneHash, which is one-way). Key comes from PROFILE_ENCRYPTION_KEY (a
 * 32-byte hex string) so it can be rotated independently of JWT secrets.
 *
 * Output format: `<ivHex>:<authTagHex>:<ciphertextHex>` — self-contained, no
 * external state needed to decrypt other than the key.
 */

const ALGORITHM = 'aes-256-gcm';

function loadKey(): Buffer {
  const hex = process.env.PROFILE_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'PROFILE_ENCRYPTION_KEY is not set — required to store/read a mentor\'s real name.',
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('PROFILE_ENCRYPTION_KEY must decode to exactly 32 bytes (a 64-char hex string).');
  }
  return key;
}

export function encryptRealName(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptRealName(payload: string): string {
  const key = loadKey();
  const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted real-name payload.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
