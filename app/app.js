// OuchMac Web — Cyberpunk Dungeon Edition
(function () {
    'use strict';

    // ── State ──────────────────────────────────────────
    const state = {
        mode: localStorage.getItem('ouch_mode') || 'adults',
        sensitivity: localStorage.getItem('ouch_sensitivity') || 'medium',
        hitCount: parseInt(localStorage.getItem('ouch_hits') || '0', 10),
        listening: false,
        lastHitTime: 0,
        debounceMs: 1500,
        maxHP: 100,
        dead: false,
        killCount: parseInt(localStorage.getItem('ouch_kills') || '0', 10),
    };

    const thresholds = { low: 18, medium: 12, high: 7 };

    const quips = [
        '',
        '> first blood...',
        '> the device trembles',
        '> pain receptors activated',
        '> structural damage detected',
        '> WARNING: integrity failing',
        '> this is getting brutal',
        '> the machine cries out',
        '> SYSTEM ALERT: mercy requested',
        '> "why do you hurt me?"',
        '> entering critical zone',
        '> device is questioning its existence',
        '> RAGE MODE UNLOCKED',
        '> you monster.',
        '> filing restraining order...',
        '> HP critically low!',
    ];

    const critMessages = [
        'CRITICAL HIT!',
        'DEVASTATING BLOW!',
        'ULTRA COMBO!',
        'OVERKILL!',
        'FATALITY!',
        'WASTED!',
        'K.O.!',
        'BRUTAL!',
    ];

    // ── DOM refs ───────────────────────────────────────
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const els = {
        hitFlash: $('#hit-flash'),
        critText: $('#crit-text'),
        logo: $('.glitch'),
        statusText: $('#status-text'),
        hitRing: $('#hit-ring'),
        hitCount: $('#hit-count'),
        hitQuip: $('#hit-quip'),
        hpFill: $('#hp-fill'),
        hpText: $('#hp-text'),
        btnStart: $('#btn-start'),
        btnSimulate: $('#btn-simulate'),
        btnReset: $('#btn-reset'),
        thresholdLabel: $('#threshold-label'),
    };

    // ── Audio (MP3 files + Web Audio API synth fallback) ──
    let audioCtx = null;
    const loadedSounds = { adults: [], kids: [] };
    let soundsLoaded = false;

    // MP3 file manifests — 8 sound packs
    const soundFiles = {
        adults: [
            'ouch1.mp3', 'ouch2.mp3', 'ouch3.mp3',
            'ow1.mp3', 'ow2.mp3',
            'groan1.mp3', 'groan2.mp3',
            'bonk1.mp3', 'bonk2.mp3',
            'thud1.mp3',
            'drama1.mp3', 'drama2.mp3',
            'whimper1.mp3'
        ],
        kids: [
            'roar1.mp3', 'roar2.mp3',
            'beep1.mp3', 'beep2.mp3', 'beep3.mp3',
            'meow1.mp3', 'meow2.mp3',
            'hiss1.mp3',
            'squeak1.mp3', 'squeak2.mp3',
            'chirp1.mp3', 'chirp2.mp3',
            'boing1.mp3', 'boing2.mp3'
        ],
        scifi: [
            'laser1.mp3', 'laser2.mp3', 'shield1.mp3',
            'warp1.mp3', 'plasma1.mp3', 'glitch1.mp3'
        ],
        horror: [
            'scream1.mp3', 'growl1.mp3', 'creak1.mp3',
            'whisper1.mp3', 'thump1.mp3', 'chains1.mp3'
        ],
        cartoon: [
            'honk1.mp3', 'splat1.mp3', 'spring1.mp3',
            'whistle1.mp3', 'pop1.mp3', 'wobble1.mp3'
        ],
        martial: [
            'punch1.mp3', 'punch2.mp3', 'kick1.mp3',
            'chop1.mp3', 'block1.mp3', 'kiai1.mp3'
        ],
        robot: [
            'servo1.mp3', 'error1.mp3', 'clank1.mp3',
            'powerdown1.mp3', 'zap1.mp3', 'dial1.mp3'
        ],
        nature: [
            'thunder1.mp3', 'splash1.mp3', 'branch1.mp3',
            'wind1.mp3', 'rock1.mp3', 'growl1.mp3'
        ]
    };

    function ensureAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    // Preload MP3/WAV files for all packs
    function preloadSounds() {
        Object.keys(soundFiles).forEach(mode => {
            if (!loadedSounds[mode]) loadedSounds[mode] = [];
            soundFiles[mode].forEach(file => {
                const audio = new Audio('sounds/' + mode + '/' + file);
                audio.preload = 'auto';
                audio.addEventListener('canplaythrough', () => {
                    loadedSounds[mode].push(audio);
                    soundsLoaded = true;
                }, { once: true });
                audio.addEventListener('error', () => {}, { once: true });
            });
        });
    }

    function playLoadedSound(mode, volume) {
        const sounds = loadedSounds[mode];
        if (sounds.length === 0) return false;
        const sound = sounds[Math.floor(Math.random() * sounds.length)];
        const clone = sound.cloneNode();
        clone.volume = Math.max(0.15, Math.min(1.0, volume || 1.0));
        clone.play().catch(() => {});
        return true;
    }

    // Synth fallbacks per mode
    const synthFallbacks = {
        adults: [playGroan, playOw, playDramatic, playBonk, playYelp, playDarkHit, playDistortion],
        kids: [playSqueak, playBoing, playMeow, playRoar, playBeepBoop, playChirp, playWobble],
        scifi: [playDistortion, playYelp, playBonk],
        horror: [playDarkHit, playGroan, playDistortion],
        cartoon: [playBoing, playSqueak, playBonk],
        martial: [playDarkHit, playBonk, playDistortion],
        robot: [playBeepBoop, playDistortion, playBonk],
        nature: [playGroan, playDarkHit, playDistortion],
    };

    function playModeSound(volume) {
        ensureAudioCtx();
        if (playLoadedSound(state.mode, volume)) return;
        const fallbacks = synthFallbacks[state.mode] || synthFallbacks.adults;
        fallbacks[Math.floor(Math.random() * fallbacks.length)](volume);
    }

    // ── ADULT SOUNDS ──
    function playGroan() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.8);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.8);
    }

    function playOw() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.35);
    }

    function playDramatic() {
        [0, 0.12, 0.28].forEach((delay) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            const f = 500 - delay * 800;
            osc.frequency.setValueAtTime(Math.max(f, 80), audioCtx.currentTime + delay);
            osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + delay + 0.25);
            gain.gain.setValueAtTime(0.35, audioCtx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.25);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + delay);
            osc.stop(audioCtx.currentTime + delay + 0.25);
        });
    }

    function playBonk() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(900, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    }

    function playYelp() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.06);
        osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.45);
    }

    function playDarkHit() {
        // Low rumble impact
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const dist = audioCtx.createWaveShaperFunction ? null : null;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.5);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(85, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc2.start();
        osc.stop(audioCtx.currentTime + 0.5); osc2.stop(audioCtx.currentTime + 0.5);
    }

    function playDistortion() {
        // Harsh noise burst
        const bufferSize = audioCtx.sampleRate * 0.15;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        const source = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        source.connect(filter).connect(gain).connect(audioCtx.destination);
        source.start();
    }

    // ── KIDS / CREATURE SOUNDS ──
    function playSqueak() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.22);
    }

    function playBoing() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.06);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.55);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.55);
    }

    function playMeow() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(350, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    }

    function playRoar() {
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(250, audioCtx.currentTime + 0.12);
        osc.frequency.linearRampToValueAtTime(70, audioCtx.currentTime + 0.55);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(105, audioCtx.currentTime);
        osc2.frequency.linearRampToValueAtTime(260, audioCtx.currentTime + 0.12);
        osc2.frequency.linearRampToValueAtTime(65, audioCtx.currentTime + 0.55);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);
        osc.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc2.start();
        osc.stop(audioCtx.currentTime + 0.55); osc2.stop(audioCtx.currentTime + 0.55);
    }

    function playBeepBoop() {
        [0, 0.1, 0.2].forEach((delay, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime([900, 600, 1200][i], audioCtx.currentTime + delay);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.08);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + delay);
            osc.stop(audioCtx.currentTime + delay + 0.08);
        });
    }

    function playChirp() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 0.04);
        osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(2500, audioCtx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    }

    function playWobble() {
        const osc = audioCtx.createOscillator();
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 300;
        lfo.type = 'sine';
        lfo.frequency.value = 15;
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain).connect(osc.frequency);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(); lfo.start();
        osc.stop(audioCtx.currentTime + 0.4); lfo.stop(audioCtx.currentTime + 0.4);
    }

    function playSound(volume) {
        playModeSound(volume);
    }

    // ── Hit handling ───────────────────────────────────
    function triggerHit(intensity) {
        if (state.dead) return;

        const now = Date.now();
        if (now - state.lastHitTime < state.debounceMs) return;
        state.lastHitTime = now;

        state.hitCount++;
        localStorage.setItem('ouch_hits', String(state.hitCount));

        // Volume scales with hit intensity (0.15 min so light taps are audible)
        const volume = Math.max(0.15, Math.min(1.0, intensity || 0.7));
        playSound(volume);
        updateHitDisplay();
        animateHit();

        // Check if device is destroyed
        const hp = Math.max(0, state.maxHP - state.hitCount * 5);
        if (hp <= 0) {
            rageQuit();
        }
    }

    function animateHit() {
        // Red flash
        els.hitFlash.classList.add('active');
        setTimeout(() => els.hitFlash.classList.remove('active'), 200);

        // Glitch the logo
        els.logo.classList.add('hit-glitch');
        setTimeout(() => els.logo.classList.remove('hit-glitch'), 900);

        // Ring pulse
        els.hitRing.classList.add('pulse');
        setTimeout(() => els.hitRing.classList.remove('pulse'), 700);

        // Shake
        document.getElementById('app').classList.add('shake');
        setTimeout(() => document.getElementById('app').classList.remove('shake'), 600);

        // Critical hit text (random)
        const msg = critMessages[Math.floor(Math.random() * critMessages.length)];
        els.critText.textContent = msg;
        els.critText.classList.remove('show');
        void els.critText.offsetWidth; // reflow
        els.critText.classList.add('show');
        setTimeout(() => els.critText.classList.remove('show'), 900);
    }

    function updateHitDisplay() {
        els.hitCount.textContent = state.hitCount;

        // HP bar — decreases with hits, min 0
        const hp = Math.max(0, state.maxHP - state.hitCount * 5);
        const pct = (hp / state.maxHP) * 100;
        els.hpFill.style.width = pct + '%';
        els.hpText.textContent = hp + ' / ' + state.maxHP;

        // Change HP bar color based on health
        if (pct <= 20) {
            els.hpFill.style.background = 'var(--neon-red)';
            els.hpFill.style.boxShadow = '0 0 12px var(--neon-red)';
        } else if (pct <= 50) {
            els.hpFill.style.background = 'var(--neon-orange)';
            els.hpFill.style.boxShadow = '0 0 8px var(--neon-orange)';
        } else {
            els.hpFill.style.background = 'linear-gradient(90deg, var(--neon-red) 0%, var(--neon-orange) 30%, var(--neon-green) 100%)';
            els.hpFill.style.boxShadow = '0 0 8px rgba(57, 255, 20, 0.3)';
        }

        // Quip
        const idx = Math.min(state.hitCount, quips.length - 1);
        els.hitQuip.textContent = quips[idx] || '';
    }

    // ── Rage Quit Mode ─────────────────────────────────
    const rageMessages = ['RAGE QUIT!', 'TOTAL DESTRUCTION!', 'NO SURVIVORS!', 'OBLITERATED!', 'ANNIHILATED!', 'RIP IN PIECES!'];
    let rageMessageInterval = null;
    let rageTimeout = null;

    function rageQuit() {
        state.dead = true;

        // Increment kill count
        state.killCount++;
        localStorage.setItem('ouch_kills', String(state.killCount));

        // Update kill count display
        const killCountEl = document.getElementById('kill-count');
        const killCountNum = document.getElementById('kill-count-num');
        killCountNum.textContent = state.killCount;
        killCountEl.classList.add('visible');

        // Replace hit counter with skull
        els.hitCount.textContent = '💀';
        els.hitCount.style.fontSize = '60px';

        // HP bar goes fatal
        els.hpFill.classList.add('fatal');
        els.hpFill.parentElement.classList.add('fatal-bar');
        els.hpText.textContent = 'DEAD';
        els.hpText.style.color = 'var(--neon-red)';

        // Add rage-quit class to body (triggers red flash + shake)
        document.body.classList.add('rage-quit');

        // Show overlay
        const overlay = document.getElementById('rage-overlay');
        overlay.style.display = 'flex';

        // Cycle destruction messages
        let msgIdx = 0;
        const msgEl = document.getElementById('rage-messages');
        rageMessageInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % rageMessages.length;
            msgEl.textContent = rageMessages[msgIdx];
        }, 600);

        // Show respawn button after 3 seconds
        rageTimeout = setTimeout(() => {
            document.getElementById('respawn-btn').style.display = 'flex';
        }, 3000);

        // Stop shaking body after 2 seconds
        setTimeout(() => {
            document.body.classList.remove('rage-quit');
        }, 2000);

        // Status text
        showStatus('[ DEVICE DESTROYED ]', 'error');
    }

    function respawn() {
        state.dead = false;

        // Clear timers
        if (rageMessageInterval) clearInterval(rageMessageInterval);
        if (rageTimeout) clearTimeout(rageTimeout);
        rageMessageInterval = null;
        rageTimeout = null;

        // Remove rage-quit class
        document.body.classList.remove('rage-quit');

        // Hide overlay and respawn button
        document.getElementById('rage-overlay').style.display = 'none';
        document.getElementById('respawn-btn').style.display = 'none';

        // Reset HP
        state.hitCount = 0;
        localStorage.setItem('ouch_hits', '0');

        // Restore hit counter style
        els.hitCount.style.fontSize = '';

        // Remove fatal state from HP bar
        els.hpFill.classList.remove('fatal');
        els.hpFill.parentElement.classList.remove('fatal-bar');
        els.hpText.style.color = '';

        // Update display
        updateHitDisplay();

        showStatus(state.listening ? '[ SENSORS ACTIVE — AWAITING IMPACT ]' : '[ SYSTEM IDLE ]', state.listening ? 'listening' : '');
    }

    // ── Accelerometer ──────────────────────────────────
    function startListening() {
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then((response) => {
                    if (response === 'granted') {
                        bindMotion();
                    } else {
                        showStatus('[ PERMISSION DENIED ]', 'error');
                    }
                })
                .catch(() => showStatus('[ PERMISSION ERROR ]', 'error'));
        } else if ('DeviceMotionEvent' in window) {
            bindMotion();
        } else {
            showStatus('[ NO SENSORS — USE SIMULATE ]', 'error');
        }
    }

    function bindMotion() {
        window.addEventListener('devicemotion', onDeviceMotion, true);
        state.listening = true;

        els.btnStart.innerHTML = '<span class="btn-icon">🛑</span><span>DEACTIVATE</span>';
        els.btnStart.classList.add('listening');
        showStatus('[ SENSORS ACTIVE — AWAITING IMPACT ]', 'listening');
    }

    function stopListening() {
        window.removeEventListener('devicemotion', onDeviceMotion, true);
        state.listening = false;

        els.btnStart.innerHTML = '<span class="btn-icon">⚡</span><span>ACTIVATE SENSORS</span>';
        els.btnStart.classList.remove('listening');
        showStatus('[ SYSTEM IDLE ]', '');
    }

    function onDeviceMotion(event) {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        const threshold = thresholds[state.sensitivity];
        const excess = mag - (9.8 + threshold);

        if (excess > 0) {
            // Normalize intensity: 0.0 at threshold, 1.0 at 10x threshold
            const intensity = Math.min(1.0, excess / (threshold * 10));
            triggerHit(intensity);
        }
    }

    function showStatus(text, cls) {
        els.statusText.textContent = text;
        els.statusText.className = 'status-text';
        if (cls) els.statusText.classList.add(cls);
    }

    // ── UI bindings ────────────────────────────────────
    function init() {
        preloadSounds();
        updateHitDisplay();
        setMode(state.mode);
        setSensitivity(state.sensitivity);

        // Init kill count display
        const killCountNum = document.getElementById('kill-count-num');
        killCountNum.textContent = state.killCount;
        if (state.killCount > 0) {
            document.getElementById('kill-count').classList.add('visible');
        }

        // Respawn button
        document.getElementById('respawn-btn').addEventListener('click', () => {
            respawn();
        });

        $$('.mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        $$('.sens-btn').forEach((btn) => {
            btn.addEventListener('click', () => setSensitivity(btn.dataset.sens));
        });

        els.btnStart.addEventListener('click', () => {
            ensureAudioCtx();
            state.listening ? stopListening() : startListening();
        });

        els.btnSimulate.addEventListener('click', () => {
            ensureAudioCtx();
            triggerHit(0.3 + Math.random() * 0.7);
        });

        els.btnReset.addEventListener('click', () => {
            state.hitCount = 0;
            localStorage.setItem('ouch_hits', '0');
            updateHitDisplay();
        });
    }

    function setMode(mode) {
        state.mode = mode;
        localStorage.setItem('ouch_mode', mode);
        $$('.mode-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    function setSensitivity(sens) {
        state.sensitivity = sens;
        localStorage.setItem('ouch_sensitivity', sens);
        $$('.sens-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.sens === sens);
        });
        const gVal = { low: '1.8g', medium: '1.2g', high: '0.7g' };
        els.thresholdLabel.textContent = '[ DMG THRESHOLD: ' + (gVal[sens] || '1.2g') + ' ]';
    }

    // ── Boot ───────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
})();
