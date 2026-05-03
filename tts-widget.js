// tts-widget.js — подключается одной строкой, делает всё сам
// <script src="https://tts-api-hazel.vercel.app/tts-widget.js"></script>
//
// Минимальное использование:
//   TTS.init({ repo: 'Kesik80/myproject' })
//   TTS.attachTo('[data-tts]')
//
// Кнопка в HTML:
//   <button data-tts="das Wetter">🔊</button>
//   <button data-tts="die Sonne" data-tts-voice="Laura">🔊</button>

(function (global) {
  'use strict';

  // ── Конфиг (можно переопределить через TTS.init) ─────────────
  const CFG = {
    apiUrl:       'https://tts-api-hazel.vercel.app/tts-widget.js',
    repo:         'Kesik80/tts-api', // дефолтный репо — можно переопределить через TTS.init
    lang:         'de',
    defaultVoice: 'Roger',
    voiceSelectId: 'voice-select',  // id <select> на странице (если есть)
    statusBarId:   'status-bar',    // id статус-бара (если есть)
    statusTextId:  'status-text',
  };

  const VOICES = {
    Roger:   'CwhRBWXzGAHq8TQ4Fs17',
    Laura:   'FGY2WhTYpPnrIDTdsKH5',
    Liam:    'TX3LPaxmHKxFdv7VOQHJ',
    Matilda: 'XrExE9yKIg1WjnnlVkGX',
    Will:    'bIHbv24MWmeRgasZH58o',
    Jessica: 'cgSgspJ2msm6clMCkdW9',
    Eric:    'cjVigY5qzO86Huf0OWal',
    Brian:   'nPczCjzI2devNBz1zQrb',
    Daniel:  'onwK4e9ZLuTAKqWW03F9',
    Lily:    'pFZP5JQG7iQjIQuC4Bku',
    Bill:    'pqHfZKP75CvOlQylNhV4',
  };

  // ── Состояние ─────────────────────────────────────────────────
  const cache = {};
  let currentAudio = null;
  let currentBtn   = null;
  let statusTimer  = null;

  // ── Helpers ───────────────────────────────────────────────────
  function getVoiceName() {
    const sel = document.getElementById(CFG.voiceSelectId);
    return sel ? sel.value : CFG.defaultVoice;
  }

  function getVoiceId(name) {
    return VOICES[name] || VOICES[CFG.defaultVoice];
  }

  function showStatus(msg) {
    const bar  = document.getElementById(CFG.statusBarId);
    const text = document.getElementById(CFG.statusTextId);
    if (!bar || !text) return;
    text.textContent = msg;
    bar.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => bar.classList.remove('show'), 2500);
  }

  function setBtn(btn, state) {
    if (!btn) return;
    btn.classList.remove('loading', 'playing');
    btn.disabled = false;
    if (state === 'loading') { btn.classList.add('loading'); btn.disabled = true; }
    if (state === 'playing') { btn.classList.add('playing'); }
  }

  // ── speak(text, btn?, options?) ───────────────────────────────
  async function speak(text, btn, options = {}) {
    if (!text?.trim()) return;

    // Остановить предыдущее
    if (currentBtn) setBtn(currentBtn, 'idle');
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }

    const voice   = options.voice   || getVoiceName();
    const lang    = options.lang    || CFG.lang;
    const repo    = options.repo    || CFG.repo;
    const voiceId = getVoiceId(voice);
    const key     = `${voice}|${lang}|${text}`;

    setBtn(btn, 'loading');

    try {
      let url = cache[key];

      if (!url) {
        showStatus(`⏳ ${voice} · "${text.length > 28 ? text.substring(0, 28) + '…' : text}"`);
        const res = await fetch(CFG.apiUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text, voiceId, lang, repo }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        url = data.url;
        cache[key] = url;
        showStatus(data.cached ? `✓ Кэш · ${voice}` : `✓ Сгенерировано · ${voice}`);
      } else {
        showStatus(`✓ Кэш · ${voice}`);
      }

      const audio = new Audio(url);
      currentAudio = audio;
      currentBtn   = btn;
      setBtn(btn, 'playing');

      audio.onended = () => setBtn(btn, 'idle');
      audio.onerror = () => setBtn(btn, 'idle');
      await audio.play();

    } catch (err) {
      setBtn(btn, 'idle');
      showStatus('⚠ Ошибка API — Browser TTS');
      _browserFallback(text, lang);
    }
  }

  function _browserFallback(text, lang) {
    if (!('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang + '-' + lang.toUpperCase();
    utt.rate = 0.88;
    window.speechSynthesis.speak(utt);
  }

  // ── stop() ───────────────────────────────────────────────────
  function stop() {
    if (currentBtn)  setBtn(currentBtn, 'idle');
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  // ── buildVoiceSelect(selectId?) ──────────────────────────────
  // Автоматически заполняет <select id="voice-select"> голосами
  function buildVoiceSelect(selectId) {
    const id  = selectId || CFG.voiceSelectId;
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = Object.entries(VOICES).map(([name]) => {
      const gender = ['Laura','Matilda','Jessica','Lily'].includes(name) ? 'ж' : 'м';
      return `<option value="${name}">${name} · ${gender}</option>`;
    }).join('');
  }

  // ── init(options) ─────────────────────────────────────────────
  function init(options = {}) {
    Object.assign(CFG, options);
    // Если на странице есть voice-select — заполним его
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => buildVoiceSelect());
    } else {
      buildVoiceSelect();
    }
  }

  // ── attachTo(selector) ───────────────────────────────────────
  // Навешивает speak на все элементы с data-tts
  // Атрибуты:
  //   data-tts="текст"
  //   data-tts-voice="Laura"     (опционально)
  //   data-tts-lang="de"         (опционально)
  //   data-tts-repo="owner/repo" (опционально, переопределяет CFG.repo)
  function attachTo(selector) {
    document.querySelectorAll(selector).forEach(el => {
      if (el._ttsAttached) return;
      el._ttsAttached = true;
      el.addEventListener('click', e => {
        e.stopPropagation();
        const text  = el.dataset.tts;
        const voice = el.dataset.ttsVoice || undefined;
        const lang  = el.dataset.ttsLang  || undefined;
        const repo  = el.dataset.ttsRepo  || undefined;
        speak(text, el, { voice, lang, repo });
      });
    });
  }

  // ── Экспорт ──────────────────────────────────────────────────
  global.TTS = { init, speak, stop, attachTo, buildVoiceSelect, VOICES };

})(window);
