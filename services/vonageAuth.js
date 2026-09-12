import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';

let client = null;

export function getVonageClient() {
  if (client) return client;

  const applicationId = process.env.API_APPLICATION_ID;
  const privateKeyB64 = process.env.PRIVATE_KEY64;

  if (!applicationId || !privateKeyB64) {
    throw new Error('Vonage application credentials are missing (API_APPLICATION_ID / PRIVATE_KEY64)');
  }

  const credentials = new Auth({
    applicationId,
    privateKey: Buffer.from(privateKeyB64, 'base64').toString('utf-8'),
  });

  client = new Vonage(credentials);
  return client;
}
