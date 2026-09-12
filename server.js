import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFrame } from './services/gemini.js';
import { createVideoSession } from './services/vonageVideo.js';
import { callAssistant } from './services/vonageVoice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/video-session', async (req, res) => {
  try {
    const session = await createVideoSession();
    res.json({ available: true, ...session });
  } catch (err) {
    console.warn('Vonage Video session unavailable, client will fall back to local camera:', err.message);
    res.json({ available: false, reason: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { image } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }
  try {
    const description = await analyzeFrame(image);
    res.json({ description });
  } catch (err) {
    console.error('Gemini analysis failed:', err.message);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

app.post('/api/call-assistant', async (req, res) => {
  try {
    const result = await callAssistant();
    res.json({ success: true, callId: result.uuid });
  } catch (err) {
    console.error('Vonage call failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lumina running at http://localhost:${PORT}`);
});
