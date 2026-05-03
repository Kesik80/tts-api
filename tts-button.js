// tts-button.js  —  Web Component <tts-button>
// Подключение: <script src="https://YOUR-API.vercel.app/tts-button.js"></script>
//
// Использование:
//   <tts-button text="das Wetter"></tts-button>
//   <tts-button text="die Sonne" voice="Laura" lang="de"></tts-button>
//   <tts-button text="hello" voice="Roger" lang="en" label="Listen"></tts-button>

const TTS_API_URL = 'https://YOUR-API.vercel.app/api/speak'; // ← заменить

const VOICES = {
  Roger: 'CwhRBWXzGAHq8TQ4Fs17', Laura: 'FGY2WhTYpPnrIDTdsKH5',
  Liam: 'TX3LPaxmHKxFdv7VOQHJ', Matilda: 'XrExE9yKIg1WjnnlVkGX',
  Will: 'bIHbv24MWmeRgasZH58o', Jessica: 'cgSgspJ2msm6clMCkdW9',
  Eric: 'cjVigY5qzO86Huf0OWal', Brian: 'nPczCjzI2devNBz1zQrb',
  Daniel: 'onwK4e9ZLuTAKqWW03F9', Lily: 'pFZP5JQG7iQjIQuC4Bku',
  Bill: 'pqHfZKP75CvOlQylNhV4',
};

const ttsCache = {};

class TtsButton extends HTMLElement {
  // Наблюдаемые атрибуты
  static get observedAttributes() {
    return ['text', 'voice', 'lang', 'label', 'size', 'repo'];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    if (this._btn) this._render();
  }

  _render() {
    const text  = this.getAttribute('text')  || '';
    const voice = this.getAttribute('voice') || 'Roger';
    const lang  = this.getAttribute('lang')  || 'de';
    const repo  = this.getAttribute('repo')  || null;
    const label = this.getAttribute('label') || '🔊';
    const size  = this.getAttribute('size')  || '1rem';

    // Shadow DOM — стили изолированы
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = `
      <style>
        button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: rgba(255,255,255,0.6);
          font-size: ${size};
          padding: 4px 10px;
          cursor: pointer;
          transition: all 0.18s;
          font-family: inherit;
        }
        button:hover { border-color: #4fc3f7; color: #4fc3f7; }
        button.playing {
          border-color: #4fc3f7;
          color: #4fc3f7;
          animation: pulse 0.6s ease-in-out infinite alternate;
        }
        button.loading { opacity: 0.5; cursor: wait; }
        @keyframes pulse {
          from { box-shadow: 0 0 0 0 rgba(79,195,247,0.3); }
          to   { box-shadow: 0 0 0 6px rgba(79,195,247,0); }
        }
      </style>
      <button part="btn" title="${text}">${label}</button>
    `;

    this._btn = this.shadowRoot.querySelector('button');
    this._btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._speak(text, voice, lang);
    });
  }

  async _speak(text, voice, lang, repo) {
    const voiceId = VOICES[voice] || VOICES.Roger;
    const key = `${voiceId}|${lang}|${text}`;
    const btn = this._btn;

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      let url = ttsCache[key];
      if (!url) {
        const res = await fetch(TTS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceId, lang, repo }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        url = (await res.json()).url;
        ttsCache[key] = url;
      }

      const audio = new Audio(url);
      btn.classList.remove('loading');
      btn.classList.add('playing');
      btn.disabled = false;

      audio.onended = () => btn.classList.remove('playing');
      audio.onerror = () => btn.classList.remove('playing');
      await audio.play();

      this.dispatchEvent(new CustomEvent('tts-play', { bubbles: true, detail: { text, voice } }));

    } catch (err) {
      btn.classList.remove('loading', 'playing');
      btn.disabled = false;
      // Fallback → browser TTS
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = `${lang}-${lang.toUpperCase()}`;
        utt.rate = 0.9;
        window.speechSynthesis.speak(utt);
      }
    }
  }
}

customElements.define('tts-button', TtsButton);
