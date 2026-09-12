import { getVonageClient } from './vonageAuth.js';

export async function callAssistant() {
  // CONFERENCE_NUMBER is the Vonage virtual number linked to this application,
  // so it is the caller ID; ASSISTANT_PHONE_NUMBER is the human being reached.
  const fromNumber = process.env.CONFERENCE_NUMBER;
  const toNumber = process.env.ASSISTANT_PHONE_NUMBER;

  if (!toNumber) {
    throw new Error('ASSISTANT_PHONE_NUMBER is not set in .env — add the phone number the assistant should be reached on.');
  }
  if (!fromNumber) {
    throw new Error('CONFERENCE_NUMBER is not set in .env');
  }

  const vonage = getVonageClient();

  return vonage.voice.createOutboundCall({
    to: [{ type: 'phone', number: toNumber }],
    from: { type: 'phone', number: fromNumber },
    ncco: [
      {
        action: 'talk',
        text: 'Hello. This is a call from Lumina, the assisted shopping app. A shopper would like help identifying a clothing item. Please stay on the line.',
      },
    ],
  });
}
