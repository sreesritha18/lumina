import { getVonageClient } from './vonageAuth.js';

export async function createVideoSession() {
  const vonage = getVonageClient();

  const session = await vonage.video.createSession({});
  const token = vonage.video.generateClientToken(session.sessionId, { role: 'publisher' });

  // Application-based Video sessions are keyed by the application ID, not the
  // account API key — the client SDK rejects the token otherwise.
  return {
    applicationId: process.env.API_APPLICATION_ID,
    sessionId: session.sessionId,
    token,
  };
}
