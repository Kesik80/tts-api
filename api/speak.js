// tts-api/api/speak.js
// Универсальный TTS API — отдельный Vercel проект
// Деплой: github.com/YOU/tts-api → vercel.com
// Env vars: ELEVENLABS_API_KEY, GITHUB_TOKEN, GITHUB_REPO (напр. "kesik80/tts-cache")

const ALLOWED_VOICES = {
  'CwhRBWXzGAHq8TQ4Fs17': 'Roger',
  'FGY2WhTYpPnrIDTdsKH5': 'Laura',
  'TX3LPaxmHKxFdv7VOQHJ': 'Liam',
  'XrExE9yKIg1WjnnlVkGX': 'Matilda',
  'bIHbv24MWmeRgasZH58o': 'Will',
  'cgSgspJ2msm6clMCkdW9': 'Jessica',
  'cjVigY5qzO86Huf0OWal': 'Eric',
  'nPczCjzI2devNBz1zQrb': 'Brian',
  'onwK4e9ZLuTAKqWW03F9': 'Daniel',
  'pFZP5JQG7iQjIQuC4Bku': 'Lily',
  'pqHfZKP75CvOlQylNhV4': 'Bill',
};

const DEFAULT_VOICE = 'CwhRBWXzGAHq8TQ4Fs17'; // Roger

export default async function handler(req, res) {
  // ── CORS — разрешаем любой домен (можно ограничить) ──────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text, voiceId, lang = 'de', repo } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const safeVoiceId = ALLOWED_VOICES[voiceId] ? voiceId : DEFAULT_VOICE;
  const voiceName   = ALLOWED_VOICES[safeVoiceId].toLowerCase();

  const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
  const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
  // Репо берём из запроса, или из env как дефолт
  const GITHUB_REPO = repo || process.env.GITHUB_REPO_DEFAULT;

  if (!ELEVEN_API_KEY) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });
  if (!GITHUB_TOKEN)   return res.status(500).json({ error: 'GITHUB_TOKEN not set' });
  if (!GITHUB_REPO)    return res.status(500).json({ error: 'repo required (or set GITHUB_REPO_DEFAULT)' });

  // Читаемое имя файла: "das Wetter" → "das_Wetter_(Roger).mp3"
  const filename = text.trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_äöüÄÖÜß]/g, '')
    .substring(0, 60) + `_(${ALLOWED_VOICES[safeVoiceId]}).mp3`;

  const AUDIO_PATH = `audio/${lang}/${voiceName}/${filename}`;

  const ghHeaders = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 1. Проверяем кэш
    const check = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${AUDIO_PATH}`,
      { headers: ghHeaders }
    );
    if (check.status === 200) {
      const f = await check.json();
      return res.json({ url: f.download_url, cached: true, voice: voiceName });
    }

    // 2. Генерируем через ElevenLabs
    const eleven = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${safeVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!eleven.ok) {
      const err = await eleven.text();
      return res.status(502).json({ error: 'ElevenLabs error', details: err });
    }

    // 3. Сохраняем в GitHub
    const b64 = Buffer.from(await eleven.arrayBuffer()).toString('base64');
    const save = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${AUDIO_PATH}`,
      {
        method: 'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `TTS [${voiceName}/${lang}]: ${text.substring(0, 50)}`,
          content: b64,
          branch: 'main',
        }),
      }
    );
    if (!save.ok) return res.status(502).json({ error: 'GitHub save error' });

    const result = await save.json();
    return res.json({ url: result.content.download_url, cached: false, voice: voiceName });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}