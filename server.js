// server.js (basit express proxy)
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// basit CORS - üretimde domainleri kısıtla
import cors from 'cors';
app.use(cors({
  origin: ['https://senin-frontend-domain.com'] // deploy ettiğin domaini ekle
}));

app.post('/api/ai', async (req, res) => {
  const { prompt, userId, chatId } = req.body;
  if(!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    // Google AI Studio: örnek endpoint (değişebilir) — uygun endpoint docs'tan kontrol et!
    const API_KEY = process.env.GOOGLE_AI_KEY;
    if(!API_KEY) return res.status(500).json({ error: 'API key missing on server' });

    // Örnek POST — Gerçek body, model ve endpoint Google AI Studio dökümantasyonuna göre düzenlenmeli.
    const apiRes = await fetch('https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/text-bison:predict?key=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ content: prompt }],
        parameters: { temperature: 0.2, maxOutputTokens: 512 }
      })
    });

    const json = await apiRes.json();
    // parse google model output (örnek)
    const reply = (json?.predictions?.[0]?.content) || (json?.predictions?.[0]) || JSON.stringify(json);
    res.json({ reply });

  } catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, ()=> console.log('API listening', PORT));
