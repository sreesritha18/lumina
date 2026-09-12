import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PROMPT = `You are a fashion description assistant helping a blind or low-vision shopper who is holding a clothing item up to their camera. In 2-4 short sentences written for text-to-speech (no markdown, no bullet points, no asterisks), describe:
1. The garment's silhouette or type (e.g. fitted A-line dress, oversized hoodie).
2. Fabric texture (e.g. ribbed knit, smooth silk, crinkled linen).
3. Color(s) and pattern (e.g. solid navy, red floral print, diagonal stripes).
4. Any visible care tag text, read verbatim if legible; otherwise say the tag isn't visible.

Then finish with exactly one more sentence starting with "Pair it with" that suggests a specific garment or accessory this would go well with, naming the colour and item (for example, "Pair it with cream wide-leg trousers and tan leather sandals."). Base the pairing on the colour, formality and season the item suggests.

Be concise and concrete. If the image is blurry, dark, or nothing is visible, say so plainly and suggest holding the item closer or steadier instead of guessing, and in that case do not add a pairing suggestion.`;

export async function analyzeFrame(base64Jpeg) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: base64Jpeg } },
        ],
      },
    ],
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }
  return text;
}
