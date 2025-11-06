  // ====== Performance Utilities ======
  const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  const throttle = (fn, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // ====== DOM Elements Cache ======
  const textInput = document.getElementById('textInput');
  const reader = document.getElementById('reader');
  const loadSample = document.getElementById('loadSample');
  const resetHL = document.getElementById('resetHL');
  const recLangRadios = Array.from(document.querySelectorAll('input[name="recLang"]'));
  const langToggleEl = document.querySelector('.lang-toggle');
  const langSliderEl = langToggleEl?.querySelector('.lang-toggle__slider');
  const recStatus = document.getElementById('recStatus');
  const lipToggleButton = document.getElementById('btnLipToggle');
  const lipStatusEl = document.getElementById('lipStatus');
  const lipActivityFillEl = document.getElementById('lipActivityFill');
  const lipDisplayEl = document.getElementById('lipDisplay');
  const lipStateMapEl = document.getElementById('lipStateMap');
  const lipStateClosedEl = document.getElementById('lipStateClosed');
  const lipStateAjarEl = document.getElementById('lipStateAjar');
  const lipStateOpenEl = document.getElementById('lipStateOpen');

  const lipSyncState = {
    ready: false,
    active: false,
    hasFace: false,
    isOpen: false,
    activity: 0,
    stability: 0,
    syncScore: 0,
    openness: 0,
    lastUpdated: 0
  };
  let lipConfidenceRefreshId = null;

  // ====== Lightweight Highlight + Timing Helpers ======
  class ConfidenceBasedHighlighter {
    constructor() {
      this.confidenceLevels = [
        { name: 'very-low', min: 0.0, max: 0.3, opacity: 0.55, blur: 0, color: 'var(--miss-text)', shadow: 'rgba(239, 71, 111, 0.24)', backdrop: 'linear-gradient(135deg, rgba(239, 71, 111, 0.12), rgba(239, 71, 111, 0.05))', glow: 'var(--glow-error)' },
        { name: 'low', min: 0.3, max: 0.5, opacity: 0.68, blur: 0, color: 'var(--miss-text)', shadow: 'rgba(239, 71, 111, 0.18)', backdrop: 'linear-gradient(135deg, rgba(239, 71, 111, 0.1), rgba(239, 71, 111, 0.04))', glow: 'var(--glow-error)' },
        { name: 'medium', min: 0.5, max: 0.7, opacity: 0.8, blur: 0, color: 'var(--accent-500)', shadow: 'rgba(250, 188, 60, 0.22)', backdrop: 'linear-gradient(135deg, rgba(255, 214, 102, 0.18), rgba(255, 182, 77, 0.08))', glow: 'rgba(250, 188, 60, 0.22)' },
        { name: 'high', min: 0.7, max: 0.9, opacity: 0.92, blur: 0, color: 'var(--match-text)', shadow: 'rgba(56, 176, 96, 0.28)', backdrop: 'linear-gradient(135deg, rgba(76, 175, 80, 0.28), rgba(56, 142, 60, 0.16))', glow: 'var(--glow-success)' },
        { name: 'very-high', min: 0.9, max: 1.01, opacity: 1, blur: 0, color: 'var(--match-text)', shadow: 'rgba(56, 176, 96, 0.32)', backdrop: 'linear-gradient(135deg, rgba(76, 175, 80, 0.34), rgba(46, 125, 50, 0.18))', glow: 'var(--glow-success)' }
      ];
    }

    clamp(confidence) {
      if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
        return 0;
      }
      return Math.min(1, Math.max(0, confidence));
    }

    getConfidenceLevel(confidence) {
      const safe = this.clamp(confidence);
      const level = this.confidenceLevels.find(l => safe >= l.min && safe < l.max) || this.confidenceLevels[this.confidenceLevels.length - 1];
      return { ...level, value: safe };
    }

    applyConfidenceStyle(element, confidence, state = 'pending', isActive = false) {
      if (!element) return;
      const level = this.getConfidenceLevel(confidence);
      const isMatched = state === 'matched';
      const isMissed = state === 'missed';
      const baseGlow = isMissed ? 'var(--glow-error)' : (isMatched ? 'var(--glow-success)' : level.glow || 'var(--glow-neutral)');
      const baseBackdrop = isMissed
        ? 'linear-gradient(135deg, rgba(239, 71, 111, 0.22), rgba(239, 71, 111, 0.1))'
        : (isMatched
          ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.42), rgba(56, 142, 60, 0.22))'
          : (level.backdrop || 'linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.08))'));

      element.dataset.confidence = level.name;
      element.dataset.confidenceValue = level.value.toFixed(2);
      element.dataset.confidenceState = state;
      element.dataset.active = isActive ? 'true' : 'false';

      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'opacity, filter, transform';
      element.style.setProperty('--confidence-scale', isActive ? '1.06' : '1');
      element.style.setProperty('--confidence-opacity', isActive ? Math.min(1, level.opacity + 0.08).toString() : level.opacity.toString());
      const blurValue = isMatched ? Math.max(0, level.blur * 0.35) : (isMissed ? Math.max(level.blur, 2.6) : level.blur);
      element.style.setProperty('--confidence-blur', `${blurValue}px`);
      element.style.setProperty('--confidence-color', isMissed ? 'var(--miss-text)' : (isMatched ? 'var(--match-text)' : level.color));
      const shadowColor = isMissed ? 'rgba(239, 71, 111, 0.32)' : (isMatched ? 'rgba(56, 176, 96, 0.38)' : (level.shadow || 'rgba(16, 18, 22, 0.12)'));
      element.style.setProperty('--confidence-shadow', shadowColor);
      element.style.setProperty('--confidence-backdrop', baseBackdrop);
      const inactiveGlow = isMissed ? 'rgba(239, 71, 111, 0.18)' : (isMatched ? 'rgba(56, 176, 96, 0.22)' : 'rgba(16, 18, 22, 0.08)');
      element.style.setProperty('--confidence-glow', isActive ? baseGlow : inactiveGlow);
    }
  }

  class ConfidenceInterpolator {
    constructor() {
      this.history = [];
      this.maxHistorySize = 12;
    }

    smoothConfidence(confidence) {
      const safe = clampConfidence(confidence, 0.5);
      this.history.push(safe);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
      const avg = this.history.reduce((sum, value) => sum + value, 0) / this.history.length;
      return avg;
    }

    reset() {
      this.history.length = 0;
    }
  }

  class LightweightTimingGenerator {
    constructor() {
      this.audioContext = null;
    }

    ensureContext() {
      if (this.audioContext) return this.audioContext;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        this.audioContext = new Ctx({ latencyHint: 'interactive' });
      } catch (_err) {
        this.audioContext = null;
      }
      return this.audioContext;
    }

    async decodeAudioData(arrayBuffer) {
      const ctx = this.ensureContext();
      if (!ctx) throw new Error('AudioContext is not supported in this browser.');
      return await ctx.decodeAudioData(arrayBuffer.slice(0));
    }

    async generateTimingsFromAudio(audioBuffer, lyrics) {
      if (!audioBuffer) throw new Error('audioBuffer is required');
      const words = lyrics.split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      const energyProfile = await this.extractEnergyProfile(audioBuffer);
      const peaks = this.detectPeaks(energyProfile);
      return this.mapPeaksToWords(peaks, words, audioBuffer.duration);
    }

    async extractEnergyProfile(audioBuffer) {
      const channelData = audioBuffer.getChannelData(0);
      const windowSize = 1024;
      const hopSize = 512;
      const profile = [];
      for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
        let energy = 0;
        for (let j = 0; j < windowSize; j++) {
          const sample = channelData[i + j];
          energy += sample * sample;
        }
        profile.push(Math.sqrt(energy / windowSize));
      }
      return profile;
    }

    detectPeaks(energyData) {
      if (!energyData.length) return [];
      const threshold = this.calculateAdaptiveThreshold(energyData);
      const peaks = [];
      for (let i = 1; i < energyData.length - 1; i++) {
        const value = energyData[i];
        if (value > threshold && value > energyData[i - 1] && value > energyData[i + 1]) {
          peaks.push(i);
        }
      }
      return peaks;
    }

    calculateAdaptiveThreshold(values) {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);
      return mean + std * 0.6;
    }

    mapPeaksToWords(peaks, words, duration) {
      if (!words.length) return [];
      if (!peaks.length) {
        const avgDuration = duration / words.length;
        return words.map((word, index) => ({
          word,
          start: index * avgDuration,
          end: (index + 1) * avgDuration,
          confidence: 0.7
        }));
      }
      const timings = [];
      const avgDistance = peaks.length > 1 ? (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1) : peaks[0] || 0;
      const normalizedPeaks = peaks.map(p => p / (avgDistance || 1));
      const scale = duration / Math.max(normalizedPeaks[normalizedPeaks.length - 1] || 1, words.length);
      words.forEach((word, index) => {
        const start = (normalizedPeaks[index] ?? index) * scale;
        const end = (normalizedPeaks[index + 1] ?? (index + 1)) * scale;
        timings.push({ word, start, end, confidence: 0.7 });
      });
      return timings;
    }
  }

  class MouthStateHysteresis {
    constructor() {
      this.openThreshold = 0.34;
      this.closeThreshold = 0.2;
      this.minFrames = 2;
      this.state = 'CLOSED';
      this.counter = 0;
    }

    update(mar) {
      if (this.state === 'CLOSED') {
        if (mar >= this.openThreshold) {
          this.counter++;
          if (this.counter >= this.minFrames) {
            this.state = 'OPEN';
            this.counter = 0;
          }
        } else {
          this.counter = 0;
        }
      } else {
        if (mar <= this.closeThreshold) {
          this.counter++;
          if (this.counter >= this.minFrames) {
            this.state = 'CLOSED';
            this.counter = 0;
          }
        } else {
          this.counter = 0;
        }
      }
      return this.state === 'OPEN';
    }
  }

  class LipSyncTracker {
    constructor({ statusEl, meterFillEl, displayEl } = {}) {
      this.statusEl = statusEl || null;
      this.meterFillEl = meterFillEl || null;
      this.displayEl = displayEl || null;
      this.videoEl = document.createElement('video');
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.videoEl.autoplay = true;
      this.videoEl.setAttribute('aria-hidden', 'true');
      this.videoEl.style.position = 'fixed';
      this.videoEl.style.opacity = '0';
      this.videoEl.style.pointerEvents = 'none';
      this.videoEl.style.width = '1px';
      this.videoEl.style.height = '1px';
      this.workCanvas = document.createElement('canvas');
      this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
      this.detector = null;
      this.detectorReady = false;
      this.metricsListener = null;
      this.running = false;
      this.frameHandle = null;
      this.stream = null;
      this.ready = false;
      this.hysteresis = new MouthStateHysteresis();
      this.activity = 0;
      this.stability = 0;
      this.lastStatus = '';
      this.micActive = false;
      this.prevMouthLuma = null;
      this.prevMouthSize = null;
      this.processLoop = this.processLoop.bind(this);
      this.updateDisplay('off');
      this.updateMeter(0);
    }

    onMetrics(callback) {
      this.metricsListener = typeof callback === 'function' ? callback : null;
    }

    isActive() {
      return this.running;
    }

    async ensureDetector() {
      if (this.detectorReady) {
        return this.detector;
      }
      if ('FaceDetector' in window) {
        try {
          // Shape Detection API FaceDetector (公式ドキュメント: https://developer.mozilla.org/docs/Web/API/FaceDetector )
          this.detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        } catch (err) {
          console.warn('FaceDetector 初期化に失敗しました', err);
          this.detector = null;
        }
      } else {
        this.detector = null;
      }
      this.detectorReady = true;
      this.ready = true;
      return this.detector;
    }

    setMicActive(isActive) {
      this.micActive = !!isActive;
      this.updateMicState();
    }

    async waitForMetadata() {
      if (this.videoEl.readyState >= 1) {
        return;
      }
      await new Promise((resolve) => {
        const handleLoaded = () => resolve();
        this.videoEl.addEventListener('loadedmetadata', handleLoaded, { once: true });
      });
    }

    async start() {
      await this.ensureDetector();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.setStatus('カメラが利用できません');
        const error = new Error('Camera not supported');
        this.emitMetrics({ ready: this.ready, active: false, hasFace: false, isOpen: false, activity: 0, stability: this.stability, syncScore: 0, timestamp: this.now() });
        throw error;
      }
      if (this.running) return true;
      this.setStatus('カメラ初期化中…');
      try {
        // MediaDevices.getUserMedia (公式ドキュメント: https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia )
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        this.videoEl.srcObject = this.stream;
        await this.waitForMetadata();
        await this.videoEl.play().catch(()=>{});
        this.running = true;
        this.updateDisplay('idle');
        this.processLoop();
        this.emitMetrics({ ready: this.ready, active: true, hasFace: false, isOpen: false, activity: 0, stability: this.stability, syncScore: 0, timestamp: this.now() });
        return true;
      } catch (err) {
        console.error('Camera start failed', err);
        this.setStatus('カメラを開始できません: ' + err.message);
        await this.stop(true);
        throw err;
      }
    }

    async stop(force = false) {
      this.running = false;
      if (this.frameHandle) {
        cancelAnimationFrame(this.frameHandle);
        this.frameHandle = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      this.videoEl.srcObject = null;
      this.prevMouthLuma = null;
      this.prevMouthSize = null;
      this.activity = 0;
      this.stability *= 0.6;
      this.updateDisplay('off');
      this.updateMeter(0);
      this.setStatus('停止中');
      this.emitMetrics({ ready: this.ready, active: false, hasFace: false, isOpen: false, activity: 0, stability: this.stability, syncScore: 0, timestamp: this.now() });
    }

    async processLoop() {
      if (!this.running) return;
      if (!this.videoEl || this.videoEl.readyState < 2) {
        this.frameHandle = requestAnimationFrame(this.processLoop);
        return;
      }

      const width = this.videoEl.videoWidth || 640;
      const height = this.videoEl.videoHeight || 480;

      if (!width || !height) {
        this.frameHandle = requestAnimationFrame(this.processLoop);
        return;
      }

      if (this.workCanvas.width !== width || this.workCanvas.height !== height) {
        this.workCanvas.width = width;
        this.workCanvas.height = height;
      }

      this.workCtx.drawImage(this.videoEl, 0, 0, width, height);

      let detection = null;
      if (this.detector) {
        try {
          const faces = await this.detector.detect(this.videoEl);
          if (faces && faces.length) {
            detection = faces[0].boundingBox || faces[0];
          }
        } catch (err) {
          console.warn('FaceDetector の検出に失敗しました', err);
          this.detector = null;
          this.setStatus('顔検出が一時的に利用できません');
        }
      }

      const normalizedDetection = this.normalizeRect(detection);
      const hasFace = !!normalizedDetection;
      const mouthBox = this.deriveMouthBox(normalizedDetection, width, height);
      const motion = this.calculateMouthMotion(mouthBox);
      const isOpen = this.hysteresis.update(motion.openEstimate);

      this.activity = this.activity * 0.6 + motion.activity * 0.4;
      this.stability = hasFace
        ? Math.min(1, this.stability * 0.84 + 0.16)
        : this.stability * 0.7;

      const syncScore = (this.activity * 0.7 + (isOpen ? 0.3 : 0)) * this.stability;

      this.updateMeter(this.activity);
      this.updateDisplay(!hasFace ? 'idle' : (isOpen ? 'speaking' : 'listening'));
      if (!hasFace) {
        this.setStatus('顔が検出されません');
      } else if (isOpen) {
        this.setStatus(`発話中 (開口推定 ${motion.openEstimate.toFixed(2)})`);
      } else {
        this.setStatus('待機中');
      }

      const now = this.now();
      this.emitMetrics({
        ready: this.ready,
        active: true,
        hasFace,
        isOpen,
        activity: this.activity,
        stability: this.stability,
        syncScore,
        openness: motion.openEstimate,
        timestamp: now
      });

      this.frameHandle = requestAnimationFrame(this.processLoop);
    }

    normalizeRect(rect) {
      if (!rect) return null;
      const x = typeof rect.x === 'number' ? rect.x : (typeof rect.left === 'number' ? rect.left : 0);
      const y = typeof rect.y === 'number' ? rect.y : (typeof rect.top === 'number' ? rect.top : 0);
      const width = typeof rect.width === 'number' ? rect.width : (typeof rect.right === 'number' ? rect.right - x : 0);
      const height = typeof rect.height === 'number' ? rect.height : (typeof rect.bottom === 'number' ? rect.bottom - y : 0);
      return { x, y, width, height };
    }

    deriveMouthBox(detection, width, height) {
      const base = detection || { x: width * 0.2, y: height * 0.35, width: width * 0.6, height: height * 0.5 };
      const x = Math.max(0, base.x + base.width * 0.2);
      const mouthWidth = Math.min(width - x, base.width * 0.6);
      const y = Math.max(0, base.y + base.height * 0.55);
      const mouthHeight = Math.min(height - y, base.height * 0.3);
      return { x, y, width: Math.max(1, mouthWidth), height: Math.max(1, mouthHeight) };
    }

    calculateMouthMotion(mouthBox) {
      if (!this.workCtx || !mouthBox) {
        return { activity: 0, openEstimate: 0 };
      }
      const { x, y, width, height } = mouthBox;
      const imageData = this.workCtx.getImageData(x, y, width, height);
      const { data } = imageData;
      const pixelCount = width * height;
      if (!pixelCount) {
        return { activity: 0, openEstimate: 0 };
      }

      if (!this.prevMouthLuma || !this.prevMouthSize || this.prevMouthSize.width !== width || this.prevMouthSize.height !== height) {
        this.prevMouthLuma = new Float32Array(pixelCount);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          this.prevMouthLuma[p] = luma;
        }
        this.prevMouthSize = { width, height };
        return { activity: 0, openEstimate: 0 };
      }

      let diff = 0;
      let verticalSpread = 0;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        diff += Math.abs(luma - this.prevMouthLuma[p]);
        const row = Math.floor(p / width);
        const deviation = Math.abs(luma - this.prevMouthLuma[p]);
        verticalSpread += deviation * (row / Math.max(1, height - 1));
        this.prevMouthLuma[p] = luma;
      }

      const motion = diff / (pixelCount * 255);
      const spread = verticalSpread / (pixelCount * 255);
      const openEstimate = clampConfidence(motion * 1.8 + spread * 0.9, 0.1);
      return {
        activity: clampConfidence(motion * 1.5 + spread * 0.5, 0.05),
        openEstimate
      };
    }

    updateMeter(activity) {
      if (!this.meterFillEl) return;
      const clamped = Math.max(0.05, Math.min(1, activity));
      this.meterFillEl.style.transform = `scaleX(${clamped})`;
    }

    updateDisplay(state) {
      if (this.displayEl) {
        this.displayEl.dataset.state = state;
      }
      this.updateMicState();
    }

    updateMicState() {
      if (this.displayEl) {
        this.displayEl.dataset.mic = this.micActive ? 'on' : 'off';
      }
    }

    setStatus(message) {
      if (this.statusEl && this.lastStatus !== message) {
        this.statusEl.textContent = message;
        this.lastStatus = message;
      }
    }

    emitMetrics(metrics) {
      if (this.metricsListener) {
        this.metricsListener(metrics);
      }
    }

    now() {
      return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }
  }

  const confidenceHighlighter = new ConfidenceBasedHighlighter();
  const confidenceInterpolator = new ConfidenceInterpolator();
  const timingGenerator = new LightweightTimingGenerator();
  const lipSyncTracker = new LipSyncTracker({
    statusEl: lipStatusEl,
    meterFillEl: lipActivityFillEl,
    displayEl: lipDisplayEl
  });

  function clampUnitValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  function updateLipStateIndicators() {
    const active = lipSyncState.active && lipSyncState.ready;
    const faceDetected = active && lipSyncState.hasFace;
    const faceState = !lipSyncState.active ? 'idle' : (faceDetected ? 'detected' : 'lost');
    const openness = active ? clampUnitValue(lipSyncState.openness) : 0;
    const stability = active ? clampUnitValue(lipSyncState.stability) : 0;
    const closedLevel = active ? clampUnitValue(1 - openness * 1.4) : 0;
    const ajarLevel = active ? clampUnitValue(1 - Math.abs(openness - 0.5) * 3) : 0;
    const openLevel = active ? clampUnitValue((openness - 0.35) / 0.65) : 0;

    if (lipStateClosedEl) {
      lipStateClosedEl.style.setProperty('--fill', closedLevel.toFixed(3));
    }
    if (lipStateAjarEl) {
      lipStateAjarEl.style.setProperty('--fill', ajarLevel.toFixed(3));
    }
    if (lipStateOpenEl) {
      lipStateOpenEl.style.setProperty('--fill', openLevel.toFixed(3));
    }

    const stage = !active
      ? 'idle'
      : (openness > 0.6 ? 'open' : (openness > 0.35 ? 'ajar' : 'closed'));

    if (lipStateMapEl) {
      lipStateMapEl.dataset.stage = stage;
      lipStateMapEl.dataset.face = faceState;
      lipStateMapEl.dataset.stability = !active ? 'idle' : (stability > 0.65 ? 'steady' : (stability > 0.35 ? 'fair' : 'low'));
    }
    if (lipDisplayEl) {
      lipDisplayEl.dataset.level = stage;
      lipDisplayEl.dataset.face = faceState;
    }
  }

  updateLipStateIndicators();

  lipSyncTracker.onMetrics((metrics) => {
    const timestamp = metrics && typeof metrics.timestamp === 'number'
      ? metrics.timestamp
      : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
    lipSyncState.active = metrics ? metrics.active !== false : false;
    lipSyncState.ready = !!(metrics && metrics.ready) && lipSyncState.active;
    lipSyncState.hasFace = !!(metrics && metrics.hasFace) && lipSyncState.active;
    lipSyncState.isOpen = !!(metrics && metrics.isOpen) && lipSyncState.active;
    lipSyncState.activity = lipSyncState.active ? Math.max(0, metrics.activity || 0) : 0;
    lipSyncState.stability = lipSyncState.active ? Math.max(0, metrics.stability || 0) : 0;
    lipSyncState.syncScore = lipSyncState.active ? Math.max(0, metrics.syncScore || 0) : 0;
    lipSyncState.openness = lipSyncState.active
      ? clampUnitValue(metrics && typeof metrics.openness === 'number' ? metrics.openness : 0)
      : 0;
    lipSyncState.lastUpdated = timestamp;
    if(lipToggleButton && !lipToggleButton.disabled){
      lipToggleButton.textContent = lipSyncState.active ? 'カメラ停止' : 'カメラ開始';
    }
    updateLipStateIndicators();
    scheduleLipConfidenceRefresh();
  });

  // ====== Unified Toggle Slider System ======
  const createToggleSlider = (toggleEl, sliderEl, offsetVar, widthVar) => {
    if (!toggleEl || !sliderEl) return null;

    // Cache for computed styles to avoid repeated calculations
    let cachedMetrics = null;
    let metricsValid = false;

    const invalidateMetrics = () => { metricsValid = false; };

    const getMetrics = () => {
      if (metricsValid && cachedMetrics) return cachedMetrics;
      const rect = toggleEl.getBoundingClientRect();
      const styles = getComputedStyle(toggleEl);
      cachedMetrics = {
        rect,
        paddingLeft: parseFloat(styles.paddingLeft) || 0,
        paddingRight: parseFloat(styles.paddingRight) || 0,
        borderLeft: parseFloat(styles.borderLeftWidth) || 0,
        borderRight: parseFloat(styles.borderRightWidth) || 0
      };
      metricsValid = true;
      return cachedMetrics;
    };

    const updateSlider = () => {
      const activeInput = toggleEl.querySelector('input[type="radio"]:checked');
      if (!activeInput) return;
      const activeLabel = toggleEl.querySelector(`label[for="${activeInput.id}"]`);
      if (!activeLabel) return;

      const { rect, paddingLeft, borderLeft } = getMetrics();
      const labelRect = activeLabel.getBoundingClientRect();
      if (!labelRect.width) return;

      const offset = labelRect.left - rect.left - borderLeft - paddingLeft;
      toggleEl.style.setProperty(offsetVar, `${offset}px`);
      toggleEl.style.setProperty(widthVar, `${labelRect.width}px`);
    };

    const scheduleUpdate = () => requestAnimationFrame(updateSlider);

    // Invalidate cache on resize
    const handleResize = debounce(() => {
      invalidateMetrics();
      scheduleUpdate();
    }, 100);

    window.addEventListener('resize', handleResize);

    return { updateSlider, scheduleUpdate, invalidateMetrics };
  };

  // Initialize language toggle slider
  const langSlider = createToggleSlider(langToggleEl, langSliderEl, '--slider-offset', '--slider-width');
  if (langSlider) {
    langSlider.scheduleUpdate();
    recLangRadios.forEach(input => {
      input.addEventListener('change', langSlider.scheduleUpdate);
      input.addEventListener('focus', langSlider.scheduleUpdate);
    });
  }

  // ====== Unified Draggable Toggle System ======
  const createDraggableToggle = (toggleEl, sliderEl, options, radioInputs, sliderUpdater, offsetVar, widthVar) => {
    if (!toggleEl || !sliderEl) return;

    const dragState = {
      active: false,
      pointerId: null,
      rect: null,
      paddingLeft: 0,
      paddingRight: 0,
      borderLeft: 0,
      borderRight: 0,
      hover: null
    };

    const ensureMetrics = () => {
      dragState.rect = toggleEl.getBoundingClientRect();
      const styles = getComputedStyle(toggleEl);
      dragState.paddingLeft = parseFloat(styles.paddingLeft) || 0;
      dragState.paddingRight = parseFloat(styles.paddingRight) || 0;
      dragState.borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      dragState.borderRight = parseFloat(styles.borderRightWidth) || 0;
    };

    const commitOption = (label) => {
      if (!label) return;
      const id = label.getAttribute('for');
      if (!id) return;
      const input = toggleEl.querySelector(`#${id}`);
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const updateDragVisual = (clientX, commit = false) => {
      if (!dragState.rect) ensureMetrics();
      const { rect, paddingLeft, paddingRight, borderLeft, borderRight } = dragState;
      if (!rect) return;
      const innerWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
      if (innerWidth <= 0) return;

      let x = clientX - rect.left - borderLeft - paddingLeft;
      x = Math.max(0, Math.min(innerWidth, x));

      let closestLabel = null;
      let minDist = Infinity;
      options.forEach(label => {
        const optionRect = label.getBoundingClientRect();
        const center = optionRect.left - rect.left - borderLeft - paddingLeft + optionRect.width / 2;
        const dist = Math.abs(center - x);
        if (dist < minDist) {
          minDist = dist;
          closestLabel = label;
        }
      });

      if (!closestLabel) return;
      if (dragState.hover && dragState.hover !== closestLabel) {
        dragState.hover.classList.remove('is-hovered');
      }
      closestLabel.classList.add('is-hovered');
      dragState.hover = closestLabel;

      const optionRect = closestLabel.getBoundingClientRect();
      const sliderWidth = optionRect.width;
      const maxOffset = Math.max(0, innerWidth - sliderWidth);
      const offset = Math.max(0, Math.min(x - sliderWidth / 2, maxOffset));
      toggleEl.style.setProperty(widthVar, `${sliderWidth}px`);
      toggleEl.style.setProperty(offsetVar, `${offset}px`);

      if (commit) {
        commitOption(closestLabel);
        if (sliderUpdater) requestAnimationFrame(sliderUpdater);
      }
    };

    const finishDrag = () => {
      if (dragState.pointerId !== null) {
        try { toggleEl.releasePointerCapture(dragState.pointerId); } catch (_err) {}
      }
      dragState.pointerId = null;
      dragState.active = false;
      toggleEl.classList.remove(`${toggleEl.classList[0]}--dragging`);
      if (dragState.hover) {
        dragState.hover.classList.remove('is-hovered');
        dragState.hover = null;
      }
      dragState.rect = null;
      if (sliderUpdater) requestAnimationFrame(sliderUpdater);
    };

    let swipeStart = 0;
    const handlePointerMove = throttle((ev) => {
      if (!dragState.active || (dragState.pointerId !== null && ev.pointerId !== dragState.pointerId)) return;
      updateDragVisual(ev.clientX, false);

      // Track swipe for navigation
      if (radioInputs) {
        const delta = ev.clientX - swipeStart;
        if (Math.abs(delta) > 50) {
          const currentIndex = radioInputs.findIndex(r => r.checked);
          if (delta > 0 && currentIndex > 0) {
            radioInputs[currentIndex - 1].checked = true;
            radioInputs[currentIndex - 1].dispatchEvent(new Event('change', { bubbles: true }));
            swipeStart = ev.clientX;
          } else if (delta < 0 && currentIndex < radioInputs.length - 1) {
            radioInputs[currentIndex + 1].checked = true;
            radioInputs[currentIndex + 1].dispatchEvent(new Event('change', { bubbles: true }));
            swipeStart = ev.clientX;
          }
        }
      }
    }, 16); // ~60fps

    const handlePointerUp = (ev) => {
      if (!dragState.active || (dragState.pointerId !== null && ev.pointerId !== dragState.pointerId)) return;
      updateDragVisual(ev.clientX, true);
      if (sliderEl) {
        sliderEl.style.transform = '';
      }
      finishDrag();
    };

    toggleEl.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const optionLabel = ev.target.closest('label');
      if (ev.pointerType === 'mouse' && optionLabel && toggleEl.contains(optionLabel)) {
        return;
      }
      ensureMetrics();
      dragState.active = true;
      dragState.pointerId = ev.pointerId;
      swipeStart = ev.clientX;
      toggleEl.classList.add(`${toggleEl.classList[0]}--dragging`);
      try { toggleEl.setPointerCapture(ev.pointerId); } catch (_err) {}
      updateDragVisual(ev.clientX, false);
      if (ev.pointerType !== 'mouse') {
        ev.preventDefault();
      }
    });

    toggleEl.addEventListener('pointermove', handlePointerMove);
    toggleEl.addEventListener('pointerup', handlePointerUp);
    toggleEl.addEventListener('pointercancel', handlePointerUp);
    toggleEl.addEventListener('lostpointercapture', finishDrag);
  };

  // Initialize language toggle drag
  if (langToggleEl && langSliderEl) {
    const langOptions = Array.from(langToggleEl.querySelectorAll('.lang-toggle__option'));
    createDraggableToggle(
      langToggleEl,
      langSliderEl,
      langOptions,
      recLangRadios,
      langSlider?.updateSlider,
      '--slider-offset',
      '--slider-width'
    );
  }
  const getSelectedLang = () => {
    const active = recLangRadios.find(input => input.checked);
    return active ? active.value : 'en-US';
  };

  const btnMicStart = document.getElementById('btnMicStart');
  const btnMicStop = document.getElementById('btnMicStop');

  // ====== Mode Toggle ======
  const recModeRadios = Array.from(document.querySelectorAll('input[name="recMode"]'));
  const modeToggleEl = document.querySelector('.mode-toggle');
  const modeSliderEl = modeToggleEl?.querySelector('.mode-toggle__slider');

  const modeSlider = createToggleSlider(modeToggleEl, modeSliderEl, '--mode-slider-offset', '--mode-slider-width');
  if (modeSlider) {
    modeSlider.scheduleUpdate();
    recModeRadios.forEach(input => {
      input.addEventListener('change', modeSlider.scheduleUpdate);
      input.addEventListener('focus', modeSlider.scheduleUpdate);
    });
  }

  if (modeToggleEl && modeSliderEl) {
    const modeOptions = Array.from(modeToggleEl.querySelectorAll('.mode-toggle__option'));
    createDraggableToggle(
      modeToggleEl,
      modeSliderEl,
      modeOptions,
      recModeRadios,
      modeSlider?.updateSlider,
      '--mode-slider-offset',
      '--mode-slider-width'
    );
  }

  // ====== Scroll Toggle ======
  const scrollModeRadios = Array.from(document.querySelectorAll('input[name="scrollMode"]'));
  const scrollToggleEl = document.querySelector('.scroll-toggle');
  const scrollSliderEl = scrollToggleEl?.querySelector('.scroll-toggle__slider');
  let autoScrollEnabled = true;

  const scrollSlider = createToggleSlider(scrollToggleEl, scrollSliderEl, '--scroll-slider-offset', '--scroll-slider-width');
  if (scrollSlider) {
    scrollSlider.scheduleUpdate();
    scrollModeRadios.forEach(input => {
      input.addEventListener('change', () => {
        autoScrollEnabled = input.value === 'auto';
        scrollSlider.scheduleUpdate();
      });
      input.addEventListener('focus', scrollSlider.scheduleUpdate);
    });
  }

  if (scrollToggleEl && scrollSliderEl) {
    const scrollOptions = Array.from(scrollToggleEl.querySelectorAll('.scroll-toggle__option'));
    createDraggableToggle(
      scrollToggleEl,
      scrollSliderEl,
      scrollOptions,
      scrollModeRadios,
      scrollSlider?.updateSlider,
      '--scroll-slider-offset',
      '--scroll-slider-width'
    );
  }

  function updateProgressIndicator(){
    // Progress indicator removed for simplified UI
  }

  function updateRealtimeTelemetry(){
    // Telemetry indicators removed for simplified UI
  }

  function updateSessionMeta(){
    // Session meta pills removed for simplified UI
  }


  // ====== 音声認識（読み上げなし） ======
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ====== 状態 ======
  let tokens = [];           // {text, type: 'word'|'ws', start}
  let wordStarts = [];       // word token の開始インデックス
  let currentWord = -1;      // 現在ハイライトしている word index
  let recognizing = false;   // mic 状態
  let lastMicIndex = -1;     // マイクで進んだインデックス
  let recognizer = null;
  let normalizedWords = [];
  let wordStates = [];
  let wordConfidence = [];
  let lastResultKey = '';
  let unmatchedCount = 0;
  let pendingGap = false;
  let lastSourceText = '';
  let shouldAutoRestart = false;
  let userStopRequested = false;
  let restartTimer = null;
  let idleTimer = null;
  let lastTranscriptTimestamp = 0;
  let recognitionSession = {resume:false, fromRestart:false};
  let permissionPrimed = false;
  let recognitionMode = 'precise';
  let lastSpeedNorm = '';
  let speedState = { history: [], map: [], lastReliable: -1, anchor: -1, missCount: 0, stability: 0, lastInputTs: 0, lastEmitTs: 0 };

  // ====== ユーティリティ ======
  function normalizeForMatch(str){
    try{
      return str.toLowerCase().replace(/[\u2019\u2018]/g, "'")
        .replace(/[^\p{L}\p{N}'\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
    }catch(e){
      return str.toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  const clampConfidence = (value, fallback = 0.5) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return Math.min(1, Math.max(0, fallback));
    }
    return Math.min(1, Math.max(0, value));
  };

  function defaultConfidenceForState(state){
    switch(state){
      case 'matched': return 0.9;
      case 'missed': return 0.25;
      default: return 0.45;
    }
  }

  function lipConfidenceAdjustment(state){
    if(!lipSyncState.ready || !lipSyncState.active){
      return 0;
    }
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const age = now - lipSyncState.lastUpdated;
    if(age > 1600){
      return 0;
    }
    const freshness = 1 - Math.min(1, age / 1600);
    const stability = Math.max(0, Math.min(1, lipSyncState.stability)) * freshness;
    const activity = Math.max(0, Math.min(1, lipSyncState.activity)) * freshness;
    const syncScore = Math.max(0, Math.min(1, lipSyncState.syncScore)) * freshness;
    switch(state){
      case 'matched':
        return stability * (syncScore * 0.35 + activity * 0.18);
      case 'pending':
        return stability * (activity * 0.28 - 0.08);
      case 'missed':
        return -stability * (0.16 + (1 - activity) * 0.25);
      default:
        return 0;
    }
  }

  function calibrateConfidenceForState(confidence, state){
    const safe = clampConfidence(confidence, defaultConfidenceForState(state));
    const adjustment = lipConfidenceAdjustment(state);
    let adjusted = clampConfidence(safe + adjustment, safe);
    if(state === 'matched') adjusted = Math.max(adjusted, 0.65);
    if(state === 'missed') adjusted = Math.min(adjusted, 0.42);
    return adjusted;
  }

  function ensureWordConfidenceLength(){
    if(wordConfidence.length !== normalizedWords.length){
      wordConfidence = new Array(normalizedWords.length).fill(defaultConfidenceForState('pending'));
    }
  }

  function refreshConfidenceStyles(){
    const spans = getWordSpans();
    ensureWordConfidenceLength();
    spans.forEach((span, idx)=>{
      const state = wordStates[idx] || 'pending';
      const confidence = calibrateConfidenceForState(wordConfidence[idx], state);
      wordConfidence[idx] = confidence;
      confidenceHighlighter.applyConfidenceStyle(span, confidence, state, span.classList.contains('word--active'));
    });
  }

  function scheduleLipConfidenceRefresh(){
    if(lipConfidenceRefreshId !== null) return;
    if(typeof requestAnimationFrame === 'function'){
      lipConfidenceRefreshId = requestAnimationFrame(()=>{
        lipConfidenceRefreshId = null;
        refreshConfidenceStyles();
      });
    }else{
      lipConfidenceRefreshId = setTimeout(()=>{
        lipConfidenceRefreshId = null;
        refreshConfidenceStyles();
      }, 120);
    }
  }

  function tokenize(text){
    tokens = []; wordStarts = []; normalizedWords = []; lastResultKey = ''; unmatchedCount = 0; pendingGap = false;
    shouldAutoRestart = false; userStopRequested = false;
    clearRestartTimer(); clearIdleGuard();
    lastTranscriptTimestamp = 0;
    lastSpeedNorm = '';
    resetSpeedState();
    let i = 0;
    while(i < text.length){
      if(/\s/.test(text[i])){
        let j = i+1; while(j < text.length && /\s/.test(text[j])) j++;
        tokens.push({text:text.slice(i,j), type:'ws', start:i});
        i = j;
      }else{
        let j = i+1; while(j < text.length && !/\s/.test(text[j])) j++;
        const wordText = text.slice(i,j);
        tokens.push({text:wordText, type:'word', start:i});
        wordStarts.push(i);
        normalizedWords.push(normalizeForMatch(wordText));
        i = j;
      }
    }
    lastSourceText = text;
    wordStates = new Array(normalizedWords.length).fill('pending');
    wordConfidence = new Array(normalizedWords.length).fill(defaultConfidenceForState('pending'));
  }

  function render(){
    const frag = document.createDocumentFragment();
    tokens.forEach((tok, k)=>{
      if(tok.type === 'word'){
        const span = document.createElement('span');
        span.className = 'word karaoke-word';
        span.dataset.i = wordIndexFromTokenIndex(k);
        span.textContent = tok.text;
        span.addEventListener('click', ()=>{
          highlightTo(parseInt(span.dataset.i,10), { manual:true });
        });
        frag.appendChild(span);
      }else{
        frag.appendChild(document.createTextNode(tok.text));
      }
    });
    reader.innerHTML = '';
    reader.appendChild(frag);
    const spans = getWordSpans();
    if(wordStates.length !== spans.length){
      wordStates = new Array(spans.length).fill('pending');
    }
    ensureWordConfidenceLength();
    spans.forEach((span, idx)=>{
      if(typeof wordConfidence[idx] !== 'number'){
        wordConfidence[idx] = defaultConfidenceForState(wordStates[idx] || 'pending');
      }
      applySpanState(span, wordStates[idx] || 'pending', idx);
    });
    currentWord = -1;
    lastMicIndex = -1;
    pendingGap = false;
    unmatchedCount = 0;
    updateProgressIndicator();
  }

  function getWordSpans(){
    return reader.querySelectorAll('.word');
  }

  function applySpanState(span, state, index){
    if(!span) return;
    span.dataset.state = state;
    span.classList.toggle('word--matched', state === 'matched');
    span.classList.toggle('word--missed', state === 'missed');
    span.classList.toggle('word--pending', state === 'pending');
    if(typeof index === 'number'){
      const confidence = calibrateConfidenceForState(wordConfidence[index], state);
      wordConfidence[index] = confidence;
      confidenceHighlighter.applyConfidenceStyle(span, confidence, state, span.classList.contains('word--active'));
    }
  }

  function updateWordState(index, state, spans, confidenceOverride){
    if(index < 0 || index >= wordStates.length) return;
    wordStates[index] = state;
    const list = spans || getWordSpans();
    const span = list[index];
    if(typeof confidenceOverride === 'number'){
      wordConfidence[index] = calibrateConfidenceForState(confidenceOverride, state);
    }else if(typeof wordConfidence[index] !== 'number'){
      wordConfidence[index] = defaultConfidenceForState(state);
    }
    if(span) applySpanState(span, state, index);
  }

  function updateWordStateRange(from, to, state, spans, confidenceOverride){
    if(!wordStates.length) return;
    const list = spans || getWordSpans();
    const start = Math.max(0, from);
    const end = Math.min(wordStates.length - 1, to);
    if(end < start) return;
    for(let i=start; i<=end; i++){
      wordStates[i] = state;
      const nextConfidence = typeof confidenceOverride === 'number' ? calibrateConfidenceForState(confidenceOverride, state) : defaultConfidenceForState(state);
      wordConfidence[i] = nextConfidence;
      const span = list[i];
      if(span) applySpanState(span, state, i);
    }
  }

  function resetAllWordStates(){
    wordStates = new Array(normalizedWords.length).fill('pending');
    wordConfidence = new Array(normalizedWords.length).fill(defaultConfidenceForState('pending'));
    const spans = getWordSpans();
    spans.forEach((span, idx)=>applySpanState(span, 'pending', idx));
    updateProgressIndicator();
  }

  function resetSpeedState(){
    speedState = { history: [], map: [], lastReliable: -1, anchor: -1, missCount: 0, stability: 0, lastInputTs: 0, lastEmitTs: 0 };
    updateRealtimeTelemetry();
    confidenceInterpolator.reset();
  }

  function rewindHighlight(targetIndex){
    const spans = getWordSpans();
    const clamped = Math.min(Math.max(targetIndex, -1), spans.length - 1);
    for(let i=clamped + 1; i<wordStates.length; i++){
      if(wordStates[i] !== 'pending'){
        wordStates[i] = 'pending';
      }
      wordConfidence[i] = defaultConfidenceForState('pending');
      const span = spans[i];
      if(span){
        span.classList.remove('word--active', 'active');
        applySpanState(span, 'pending', i);
      }
    }
    if(currentWord >= 0 && currentWord < spans.length){
      spans[currentWord].classList.remove('word--active', 'active');
      confidenceHighlighter.applyConfidenceStyle(
        spans[currentWord],
        calibrateConfidenceForState(wordConfidence[currentWord], wordStates[currentWord] || 'pending'),
        wordStates[currentWord] || 'pending',
        false
      );
    }
    currentWord = clamped;
    lastMicIndex = clamped;
    if(clamped >= 0){
      spans[clamped].classList.add('word--active', 'active');
      confidenceHighlighter.applyConfidenceStyle(
        spans[clamped],
        calibrateConfidenceForState(wordConfidence[clamped], wordStates[clamped] || 'pending'),
        wordStates[clamped] || 'pending',
        true
      );
      if(autoScrollEnabled){
        spans[clamped].scrollIntoView({block:'center', behavior:'smooth'});
      }
    }
    updateProgressIndicator();
  }

  function alignSpeedWindow(parts, baseIndex, hasFinal){
    if(parts.length === 0 || !normalizedWords.length) return null;
    const anchor = baseIndex >= 0 ? baseIndex : (currentWord >= 0 ? currentWord : -1);
    const dynamicAhead = hasFinal ? 30 : 22;
    const windowStart = Math.max(0, (anchor >= 0 ? anchor : 0) - 6);
    const windowEnd = Math.min(
      normalizedWords.length - 1,
      Math.max(anchor + 1, currentWord + 1, 0) + dynamicAhead
    );
    if(windowEnd < windowStart) return null;
    const windowWords = normalizedWords.slice(windowStart, windowEnd + 1);
    if(!windowWords.length) return null;

    const rows = parts.length + 1;
    const cols = windowWords.length + 1;
    const NEG = -1e9;
    const dp = Array.from({length: rows}, () => new Float32Array(cols).fill(NEG));
    const bt = Array.from({length: rows}, () => new Array(cols));
    const skipWordPenalty = hasFinal ? 1.2 : 0.9;
    const skipPartPenalty = hasFinal ? 1.05 : 0.75;

    dp[0][0] = 0;
    for(let j=1; j<cols; j++){
      dp[0][j] = dp[0][j-1] - skipWordPenalty;
      bt[0][j] = { i:0, j:j-1, type:'skipWord' };
    }
    for(let i=1; i<rows; i++){
      dp[i][0] = dp[i-1][0] - skipPartPenalty;
      bt[i][0] = { i:i-1, j:0, type:'skipPart' };
    }

    for(let i=1; i<rows; i++){
      const part = parts[i-1];
      for(let j=1; j<cols; j++){
        const word = windowWords[j-1];
        let rawScore = scoreWordMatch(word, part);
        if(rawScore <= -50) rawScore = -6;
        else if(rawScore < 0) rawScore = rawScore / 4;
        let bestScore = dp[i-1][j-1] + rawScore;
        let bestStep = { i:i-1, j:j-1, type:'match' };
        const skipWordScore = dp[i][j-1] - skipWordPenalty;
        if(skipWordScore > bestScore){
          bestScore = skipWordScore;
          bestStep = { i:i, j:j-1, type:'skipWord' };
        }
        const skipPartScore = dp[i-1][j] - skipPartPenalty;
        if(skipPartScore > bestScore){
          bestScore = skipPartScore;
          bestStep = { i:i-1, j:j, type:'skipPart' };
        }
        dp[i][j] = bestScore;
        bt[i][j] = bestStep;
      }
    }

    let bestCol = 0;
    let bestScore = -Infinity;
    const lastRow = rows - 1;
    for(let j=1; j<cols; j++){
      const wordIdx = windowStart + j - 1;
      const distance = anchor >= 0 ? Math.max(0, wordIdx - anchor) : Math.max(0, wordIdx);
      const penalty = distance > 0 ? Math.log2(distance + 1) * 0.35 : 0;
      const score = dp[lastRow][j] - penalty;
      if(score > bestScore){
        bestScore = score;
        bestCol = j;
      }
    }

    const mapping = new Array(parts.length).fill(-1);
    const matchedWords = [];
    let strongMatches = 0;
    let softMatches = 0;
    let i = rows - 1;
    let j = bestCol;
    while(i > 0 || j > 0){
      const step = bt[i][j];
      if(!step) break;
      if(step.type === 'match'){
        const partIdx = i - 1;
        const wordIdx = windowStart + j - 1;
        const rawScore = scoreWordMatch(windowWords[j-1], parts[i-1]);
        mapping[partIdx] = wordIdx;
        if(rawScore >= 1){
          matchedWords.push(wordIdx);
          strongMatches++;
        }else if(rawScore >= 0.5){
          matchedWords.push(wordIdx);
          softMatches++;
        }
        i = step.i;
        j = step.j;
      }else{
        i = step.i;
        j = step.j;
      }
    }

    const uniqueMatches = Array.from(new Set(matchedWords));
    const bestIndex = mapping.reduce((acc, val) => (typeof val === 'number' && val > acc) ? val : acc, -1);
    const effectiveMatches = strongMatches + softMatches * 0.5;
    const coverage = effectiveMatches / Math.max(1, parts.length);
    const rawPathScore = dp[rows - 1][bestCol];
    const scorePerToken = rawPathScore / Math.max(1, parts.length);
    const unmatchedParts = parts.length - (strongMatches + softMatches);
    return {
      mapping,
      matchedWords: uniqueMatches,
      bestIndex,
      coverage,
      scorePerToken,
      score: bestScore,
      unmatchedParts
    };
  }

  function findRealtimeCandidate(contextParts, anchor, options = {}){
    if(!contextParts.length || !normalizedWords.length) return null;
    const hasFinal = !!options.hasFinal;
    const windowAhead = typeof options.windowAhead === 'number' ? options.windowAhead : 14;
    const backtrack = typeof options.backtrack === 'number' ? options.backtrack : 2;
    let startIndex = anchor < 0 ? 0 : Math.max(0, anchor - backtrack);
    let endIndex = normalizedWords.length - 1;
    if(anchor >= 0){
      endIndex = Math.min(normalizedWords.length - 1, anchor + windowAhead);
    }else{
      endIndex = Math.min(normalizedWords.length - 1, windowAhead);
    }
    if(endIndex < startIndex) return null;

    let bestIndex = -1;
    let bestScore = -Infinity;
    let bestQuality = 0;

    for(let idx = startIndex; idx <= endIndex; idx++){
      if(idx < contextParts.length - 1) continue;
      const wordStart = idx - (contextParts.length - 1);
      if(wordStart < 0) continue;
      let score = 0;
      let valid = true;
      for(let j=0; j<contextParts.length; j++){
        const tokenScore = scoreWordMatch(normalizedWords[wordStart + j], contextParts[j]);
        if(tokenScore < 0){
          valid = false;
          break;
        }
        score += tokenScore;
      }
      if(!valid) continue;
      const avgScore = score / contextParts.length;
      const distance = anchor < 0 ? idx : Math.max(0, idx - anchor);
      const penalty = distance > 0 ? (distance * (hasFinal ? 0.16 : 0.32) + Math.log2(distance + 1) * (hasFinal ? 0.22 : 0.4)) : 0;
      const bonus = hasFinal ? contextParts.length * 0.12 : 0;
      const finalScore = score - penalty + bonus;
      if(finalScore > bestScore){
        bestScore = finalScore;
        bestIndex = idx;
        bestQuality = avgScore;
      }
    }

    if(bestIndex === -1) return null;
    const qualityThreshold = hasFinal ? 0.8 : 1.05;
    if(bestQuality < qualityThreshold) return null;
    if(!hasFinal && anchor >= 0 && bestIndex <= anchor) return null;
    return { index: bestIndex, score: bestScore, quality: bestQuality };
  }

  function processSpeedRecognition(parts, hasFinal, confidenceSeed){
    if(!normalizedWords.length) return;
    if(!parts.length){
      speedState.history = [];
      speedState.map = [];
      speedState.anchor = Math.max(currentWord, speedState.lastReliable);
      speedState.missCount = 0;
      speedState.stability = Math.max(0, speedState.stability * 0.5);
      updateRealtimeTelemetry();
      return;
    }

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    speedState.lastInputTs = now;

    const baseConfidence = clampConfidence(typeof confidenceSeed === 'number' ? confidenceSeed : (hasFinal ? 0.78 : 0.64), hasFinal ? 0.78 : 0.62);

    const prevHistory = speedState.history;
    const prevMap = speedState.map;
    const maxPrefix = Math.min(prevHistory.length, parts.length);
    let prefix = 0;
    while(prefix < maxPrefix && prevHistory[prefix] === parts[prefix]) prefix++;

    if(prefix < prevHistory.length){
      const rollbackIndex = prefix > 0 ? prevMap[prefix - 1] : -1;
      highlightTo(rollbackIndex, { outcome:'rollback' });
      speedState.anchor = rollbackIndex;
      speedState.lastReliable = rollbackIndex;
      speedState.missCount = 0;
      speedState.map = prevMap.slice(0, prefix);
      speedState.history = prevHistory.slice(0, prefix);
    }else{
      speedState.map = prevMap.slice(0, prefix);
      speedState.history = prevHistory.slice(0, prefix);
    }

    let anchor = speedState.anchor;
    if(typeof anchor !== 'number' || anchor < -1){
      anchor = -1;
    }
    if(speedState.map.length){
      const lastAssigned = speedState.map[speedState.map.length - 1];
      if(typeof lastAssigned === 'number'){
        anchor = lastAssigned;
      }
    }
    if(anchor < currentWord) anchor = currentWord;
    if(speedState.lastReliable > anchor) anchor = speedState.lastReliable;

    let fallbackNeeded = false;
    const windowAhead = hasFinal ? 26 : 14;

    for(let idx = prefix; idx < parts.length; idx++){
      const tailStart = Math.max(0, idx - 3);
      const tail = parts.slice(tailStart, idx + 1);
      const candidate = findRealtimeCandidate(tail, anchor, { hasFinal, windowAhead });
      if(candidate){
        const strongThreshold = hasFinal ? 1.05 : 1.35;
        const softThreshold = hasFinal ? 0.85 : 1.1;
        let outcome = 'match';
        let markSkipped = candidate.quality >= strongThreshold;
        if(candidate.quality < softThreshold){
          outcome = 'skip';
          markSkipped = false;
        }
        const qualityBoost = Math.max(0, candidate.quality - (hasFinal ? 0.7 : 1));
        const candidateConfidence = clampConfidence(baseConfidence + qualityBoost * 0.18, baseConfidence * 0.85);
        highlightTo(candidate.index, { outcome, markSkipped, confidence: candidateConfidence });
        speedState.map[idx] = candidate.index;
        anchor = candidate.index;
        speedState.anchor = anchor;
        speedState.lastReliable = Math.max(speedState.lastReliable, candidate.index);
        speedState.missCount = 0;
        const commitTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        speedState.lastEmitTs = commitTime;
        const stabilityBoost = outcome === 'match' ? (markSkipped ? 0.5 : 0.35) : 0.25;
        speedState.stability = Math.min(1, speedState.stability * 0.55 + stabilityBoost);
        updateRealtimeTelemetry();
      }else{
        speedState.map[idx] = -1;
        speedState.missCount = (speedState.missCount || 0) + 1;
        speedState.stability = Math.max(0, speedState.stability * 0.6 - 0.12);
        if(speedState.missCount >= (hasFinal ? 2 : 3)){
          fallbackNeeded = true;
          break;
        }
      }
    }

    if(speedState.map.length < parts.length){
      for(let i = speedState.map.length; i < parts.length; i++){
        speedState.map[i] = -1;
      }
    }

    speedState.anchor = anchor;

    if(fallbackNeeded || (hasFinal && (speedState.map[parts.length - 1] ?? -1) === -1)){
      const tailLimit = hasFinal ? 30 : 18;
      const tailParts = parts.slice(-tailLimit);
      const baseIndex = Math.max(anchor, speedState.lastReliable, currentWord);
      const alignment = alignSpeedWindow(tailParts, baseIndex, hasFinal);
      if(alignment && typeof alignment.bestIndex === 'number' && alignment.bestIndex !== -1 && alignment.bestIndex >= anchor){
        const alignmentConfidence = clampConfidence(baseConfidence + Math.max(0, alignment.scorePerToken - 0.8) * 0.12, baseConfidence);
        highlightTo(alignment.bestIndex, { outcome:'match', confidence: alignmentConfidence });
        speedState.anchor = alignment.bestIndex;
        speedState.lastReliable = alignment.bestIndex;
        speedState.map[parts.length - 1] = alignment.bestIndex;
        speedState.missCount = 0;
        const commitTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        speedState.lastEmitTs = commitTime;
        speedState.stability = Math.min(1, speedState.stability * 0.55 + 0.45);
        updateRealtimeTelemetry();
      }
    }

    speedState.history = parts.slice();
    if(speedState.map.length > parts.length){
      speedState.map.length = parts.length;
    }
    updateRealtimeTelemetry();
  }

  function wordIndexFromTokenIndex(tokenIdx){
    let count = 0; for(let i=0;i<=tokenIdx;i++) if(tokens[i].type==='word') count++; return count-1;
  }

  function highlightTo(index, options = {}){
    const { manual = false, outcome = 'match', markSkipped = true, confidence = undefined } = options;
    const wordSpans = getWordSpans();
    if(outcome === 'rollback' && !manual){
      rewindHighlight(index);
      pendingGap = false;
      unmatchedCount = 0;
      return;
    }
    if(index < 0 || index >= wordSpans.length) return;
    ensureWordConfidenceLength();
    if(!manual){
      const prev = currentWord;
      if(outcome === 'match'){
        if(markSkipped){
          const start = prev >= 0 ? prev + 1 : 0;
          if(index - start > 0){
            updateWordStateRange(start, index - 1, 'missed', wordSpans);
          }
        }
        updateWordState(index, 'matched', wordSpans, confidence);
        speedState.lastReliable = Math.max(speedState.lastReliable, index);
      }else if(outcome === 'skip'){
        if(markSkipped){
          const from = prev < index ? prev + 1 : index;
          updateWordStateRange(from, index, 'missed', wordSpans);
        }
      }
    }
    if(currentWord >= 0 && currentWord < wordSpans.length){
      const prevState = wordStates[currentWord] || 'pending';
      const prevConfidence = calibrateConfidenceForState(wordConfidence[currentWord], prevState);
      wordConfidence[currentWord] = prevConfidence;
      wordSpans[currentWord].classList.remove('word--active', 'active');
      confidenceHighlighter.applyConfidenceStyle(wordSpans[currentWord], prevConfidence, prevState, false);
    }
    wordSpans[index].classList.add('word--active', 'active');
    const activeState = wordStates[index] || 'pending';
    const baseConfidence = typeof confidence === 'number' && !manual ? confidence : wordConfidence[index];
    const activeConfidence = calibrateConfidenceForState(baseConfidence, activeState);
    wordConfidence[index] = activeConfidence;
    confidenceHighlighter.applyConfidenceStyle(wordSpans[index], activeConfidence, activeState, true);
    currentWord = index;
    lastMicIndex = index;
    pendingGap = false;
    unmatchedCount = 0;
    updateProgressIndicator();
    if(autoScrollEnabled){ wordSpans[index].scrollIntoView({block:'center', behavior:'smooth'}); }
  }

  function clearRestartTimer(){
    if(restartTimer){ clearTimeout(restartTimer); restartTimer = null; }
  }

  function clearIdleGuard(){
    if(idleTimer){ clearTimeout(idleTimer); idleTimer = null; }
  }

  function scheduleIdleGuard(){
    clearIdleGuard();
    idleTimer = setTimeout(()=>{
      if(!recognizing || !shouldAutoRestart || !recognizer) return;
      const elapsed = Date.now() - lastTranscriptTimestamp;
      if(elapsed >= 9000){
        pendingGap = true;
        recognizer.stop();
      }else{
        scheduleIdleGuard();
      }
    }, 4000);
  }

  function deriveRecognitionConfidence(results, hasFinal){
    if(!results || typeof results.length !== 'number' || !results.length){
      return hasFinal ? 0.82 : 0.6;
    }
    const list = Array.from(results);
    for(let i=list.length - 1; i>=0; i--){
      const res = list[i];
      if(!res || !res[0]) continue;
      const conf = res[0].confidence;
      if(typeof conf === 'number' && !Number.isNaN(conf)){
        if(res.isFinal){
          return clampConfidence(conf, hasFinal ? 0.85 : 0.65);
        }
        if(i === list.length - 1){
          return clampConfidence(conf, hasFinal ? 0.82 : 0.6);
        }
      }
    }
    return hasFinal ? 0.82 : 0.6;
  }

  async function primeMicPermission(){
    if(permissionPrimed) return true;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(track=>track.stop());
      permissionPrimed = true;
      return true;
    }catch(err){
      console.warn('Microphone permission request failed', err);
      return false;
    }
  }

  function levenshtein(a,b){
    const m = a.length, n = b.length;
    if(m === 0) return n;
    if(n === 0) return m;
    const dp = new Array(n + 1);
    for(let j=0;j<=n;j++) dp[j] = j;
    for(let i=1;i<=m;i++){
      let prev = dp[0];
      dp[0] = i;
      for(let j=1;j<=n;j++){
        const temp = dp[j];
        if(a[i-1] === b[j-1]) dp[j] = prev;
        else dp[j] = Math.min(prev, dp[j-1], dp[j]) + 1;
        prev = temp;
      }
    }
    return dp[n];
  }

  function scoreWordMatch(a,b){
    if(!a || !b) return -100;
    if(a === b) return 3;
    if(a.startsWith(b) || b.startsWith(a)) return 2;
    const dist = levenshtein(a,b);
    const minLen = Math.min(a.length, b.length);
    if(dist === 1) return 2;
    if(dist === 2 && minLen > 4) return 1.5;
    if(dist <= Math.ceil(minLen / 2) && minLen >= 6) return 1;
    return -100;
  }

  function findNextWordIndex(parts, baseIndex, lookAhead){
    const maxContext = Math.min(4, parts.length);
    const backtrack = 3;
    for(let context = maxContext; context >= 1; context--){
      const slice = parts.slice(-context);
      const start = Math.max(0, baseIndex + 1 - backtrack);
      const end = Math.min(normalizedWords.length - context + 1, baseIndex + 1 + lookAhead);
      if(end <= start) continue;
      let bestScore = -100;
      let bestIdx = -1;
      for(let i=start; i<end; i++){
        let score = 0;
        for(let j=0; j<context; j++){
          const candidate = normalizedWords[i+j];
          const wordScore = scoreWordMatch(candidate, slice[j]);
          if(wordScore < 0){ score = -100; break; }
          score += wordScore;
        }
        if(score <= -100) continue;
        const candidateIdx = i + context - 1;
        const distance = Math.max(0, candidateIdx - baseIndex);
        const distancePenalty = distance > 0 ? (Math.log2(distance + 1) * 0.8 + distance * 0.3) : 0;
        const finalScore = score - distancePenalty;
        if(finalScore > bestScore){
          bestScore = finalScore;
          bestIdx = candidateIdx;
        }
      }
      const minScore = context * 1.6;
      if(bestIdx !== -1 && bestScore >= minScore){
        return bestIdx;
      }
    }
    return -1;
  }

  function findBestGlobalMatch(parts, baseIndex){
    if(normalizedWords.length === 0) return -1;
    const maxContext = Math.min(4, parts.length);
    const start = Math.max(0, baseIndex + 1);
    let bestIdx = -1;
    let bestScore = -100;
    for(let context = maxContext; context >= 1; context--){
      const slice = parts.slice(-context);
      const end = normalizedWords.length - context + 1;
      if(end <= start) continue;
      for(let i=start; i<end; i++){
        let score = 0;
        for(let j=0; j<context; j++){
          const candidate = normalizedWords[i+j];
          const wordScore = scoreWordMatch(candidate, slice[j]);
          if(wordScore < 0){ score = -100; break; }
          score += wordScore;
        }
        if(score <= -100) continue;
        const candidateIdx = i + context - 1;
        const distance = candidateIdx - baseIndex;
        const penalty = distance > 0 ? (Math.log2(distance + 1) * 1.2 + distance * 0.4) : 0;
        const finalScore = score - penalty;
        if(finalScore > bestScore){
          bestScore = finalScore;
          bestIdx = candidateIdx;
        }
      }
      if(bestIdx !== -1 && bestScore >= context * 1.4){
        return bestIdx;
      }
    }
    return bestScore >= 1.5 ? bestIdx : -1;
  }

  function indexFromChar(charIndex){
    let lo = 0, hi = wordStarts.length - 1, ans = 0;
    while(lo <= hi){
      const mid = (lo + hi) >> 1;
      if(wordStarts[mid] <= charIndex){ ans = mid; lo = mid + 1; }
      else{ hi = mid - 1; }
    }
    return ans;
  }

  // ====== マイク追従（簡易） ======
  function ensureRecognizer(){
    if(recognizer) return;
    recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.onstart = handleRecognizerStart;
    recognizer.onend = handleRecognizerEnd;
    recognizer.onerror = handleRecognizerError;
    recognizer.onresult = handleRecognizerResult;
  }

  async function micStart(options = {}){
    const { resume = false, fromRestart = false } = options;
    if(!SpeechRecognition){ alert('このブラウザは SpeechRecognition に対応していません。Chrome/Edge をお試しください。'); return; }
    if(recognizing) return;

    const text = textInput.value.trim();
    if(!text){ alert('テキストを入力してください。'); return; }
    if(!resume){
      if(text !== lastSourceText || tokens.length === 0){
        tokenize(text);
        render();
      }else if(!reader.childNodes.length){
        render();
      }
    }

    const permissionOk = await primeMicPermission();
    if(!permissionOk && !permissionPrimed){
      recStatus.textContent = 'マイクが許可されていません';
      return;
    }

    clearRestartTimer();
    clearIdleGuard();
    shouldAutoRestart = true;
    userStopRequested = false;
    recognitionSession = {resume, fromRestart};

    ensureRecognizer();
    recognizer.lang = getSelectedLang();

    try{
      recognizer.start();
    }catch(err){
      console.error(err);
      recStatus.textContent = '開始できません: ' + err.message;
      btnMicStart.disabled = false;
      btnMicStop.disabled = true;
      shouldAutoRestart = false;
    }
  }

  function handleRecognizerStart(){
    lipSyncTracker.setMicActive(true);
    recognizing = true;
    btnMicStart.disabled = true;
    btnMicStop.disabled = false;
    pendingGap = false;
    unmatchedCount = 0;
    resetSpeedState();
    speedState.lastReliable = currentWord;
    speedState.anchor = currentWord;
    updateRealtimeTelemetry();
    lastTranscriptTimestamp = Date.now();
    scheduleIdleGuard();
    const modePrefix = recognitionMode === 'speed' ? '【高速】' : '【正確】';
    if(recognitionSession.fromRestart){
      recStatus.textContent = `${modePrefix}再開しました。続けて話してください`;
    }else if(!recognitionSession.resume){
      recStatus.textContent = `${modePrefix}取得中… 話し始めてください`;
    }else{
      recStatus.textContent = `${modePrefix}再接続しました`;
    }
  }

  function handleRecognizerEnd(){
    lipSyncTracker.setMicActive(false);
    recognizing = false;
    clearIdleGuard();
    if(userStopRequested || !shouldAutoRestart){
      btnMicStart.disabled = false;
      btnMicStop.disabled = true;
      lastResultKey = '';
      lastSpeedNorm = '';
      pendingGap = false;
      unmatchedCount = 0;
      recStatus.textContent = userStopRequested ? '停止しました' : '待機中';
      userStopRequested = false;
      shouldAutoRestart = false;
      updateRealtimeTelemetry();
      return;
    }
    clearRestartTimer();
    recStatus.textContent = '⏳ 無音が続いたため再接続しています…';
    restartTimer = setTimeout(()=>{ micStart({resume:true, fromRestart:true}); }, 180);
  }

  function handleRecognizerError(ev){
    console.error(ev);
    recStatus.textContent = 'エラー: ' + ev.error;
    lipSyncTracker.setMicActive(false);
    if(ev.error === 'not-allowed' || ev.error === 'service-not-allowed'){
      shouldAutoRestart = false;
      btnMicStart.disabled = false;
      btnMicStop.disabled = true;
    }
  }

  function handleRecognizerResult(ev){
    lastTranscriptTimestamp = Date.now();
    scheduleIdleGuard();
    let transcript = '';
    let hasFinal = false;
    for(let i=ev.resultIndex; i<ev.results.length; i++){
      transcript += ev.results[i][0].transcript;
      if(ev.results[i].isFinal) hasFinal = true;
    }
    const norm = normalizeForMatch(transcript);
    if(!norm){
      recStatus.textContent = '聞き取り中: ' + transcript;
      return;
    }
    const parts = norm.split(' ').filter(Boolean);
    if(parts.length === 0){
      recStatus.textContent = '聞き取り中: ' + transcript;
      return;
    }

    const rawConfidence = deriveRecognitionConfidence(ev.results, hasFinal);
    const smoothedConfidence = confidenceInterpolator.smoothConfidence(rawConfidence);

    if(recognitionMode === 'speed'){
      if(norm === lastSpeedNorm && !hasFinal){
        recStatus.textContent = '聞き取り中: ' + transcript;
        return;
      }
      lastSpeedNorm = norm;
      if(normalizedWords.length === 0){
        recStatus.textContent = '高速モード: テキストがありません';
        return;
      }
      processSpeedRecognition(parts, hasFinal, smoothedConfidence);
      recStatus.textContent = (hasFinal ? '高速認識: ' : '高速処理中: ') + transcript;
      return;
    }

    if(norm === lastResultKey && !hasFinal){
      recStatus.textContent = '聞き取り中: ' + transcript;
      return;
    }
    lastResultKey = norm;

    let baseIndex = Math.max(currentWord, lastMicIndex);
    if(baseIndex < -1) baseIndex = -1;
    const lookAhead = hasFinal ? 22 : 14;
    const targetIndex = findNextWordIndex(parts, baseIndex, lookAhead);
    if(targetIndex !== -1 && (targetIndex >= currentWord || hasFinal || currentWord === -1)){
      highlightTo(targetIndex, { outcome: 'match', confidence: smoothedConfidence });
    }else{
      unmatchedCount++;
      const needsRecovery = hasFinal || unmatchedCount >= 2 || pendingGap;
      if(needsRecovery){
        const globalIndex = findBestGlobalMatch(parts, Math.max(currentWord, lastMicIndex));
        if(globalIndex !== -1 && (globalIndex >= currentWord || currentWord === -1)){
          highlightTo(globalIndex, { outcome: 'match', confidence: smoothedConfidence * 0.95 });
        }else if(hasFinal && normalizedWords.length){
          const softAdvance = Math.min((currentWord === -1 ? 0 : currentWord + 1), normalizedWords.length - 1);
          if(softAdvance > currentWord){
            highlightTo(softAdvance, { outcome: 'skip', markSkipped:false, confidence: smoothedConfidence * 0.6 });
          }else{
            pendingGap = true;
          }
        }else{
          pendingGap = true;
        }
      }else{
        pendingGap = true;
      }
    }

    recStatus.textContent = (hasFinal ? '認識: ' : '聞き取り中: ') + transcript;
  }
  function micStop(){
    lipSyncTracker.setMicActive(false);
    userStopRequested = true;
    shouldAutoRestart = false;
    clearRestartTimer();
    clearIdleGuard();
    if(recognizer){
      try{ recognizer.stop(); }catch(e){ console.warn(e); }
    }
    lastResultKey = '';
    lastSpeedNorm = '';
    pendingGap = false;
    unmatchedCount = 0;
    resetSpeedState();
    updateRealtimeTelemetry();
  }

  // ====== UI 追加: ショートカット ======

  document.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase() === 's'){ e.preventDefault(); recognizing ? micStop() : micStart(); }
    
    // Word navigation
    if(e.key === 'ArrowRight' && !e.shiftKey){
      e.preventDefault();
      highlightTo(Math.min(currentWord+1, reader.querySelectorAll('.word').length-1), { manual:true });
    }
    if(e.key === 'ArrowLeft' && !e.shiftKey){
      e.preventDefault();
      highlightTo(Math.max(currentWord-1, 0), { manual:true });
    }
    
    // Language navigation with Shift+Arrow
    if(e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')){
      e.preventDefault();
      const currentIndex = recLangRadios.findIndex(r => r.checked);
      if(e.key === 'ArrowLeft' && currentIndex > 0){
        recLangRadios[currentIndex - 1].checked = true;
        recLangRadios[currentIndex - 1].dispatchEvent(new Event('change', {bubbles: true}));
      } else if(e.key === 'ArrowRight' && currentIndex < recLangRadios.length - 1){
        recLangRadios[currentIndex + 1].checked = true;
        recLangRadios[currentIndex + 1].dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
  });

  // ====== そのほか ======
  btnMicStart.addEventListener('click', micStart);
  btnMicStop.addEventListener('click', micStop);
  if(lipToggleButton){
    lipToggleButton.addEventListener('click', async ()=>{
      if(!lipSyncTracker) return;
      if(lipSyncTracker.isActive()){
        lipToggleButton.disabled = true;
        try{
          await lipSyncTracker.stop();
        }catch(err){
          console.error('Failed to stop lip sync tracker', err);
        }finally{
          lipToggleButton.disabled = false;
          lipToggleButton.textContent = 'カメラ開始';
        }
      }else{
        lipToggleButton.disabled = true;
        lipToggleButton.textContent = '開始中…';
        try{
          await lipSyncTracker.start();
          lipToggleButton.textContent = 'カメラ停止';
        }catch(err){
          console.error('Failed to start lip sync tracker', err);
          lipToggleButton.textContent = 'カメラ開始';
        }finally{
          lipToggleButton.disabled = false;
          if(!lipSyncTracker.isActive()){
            lipToggleButton.textContent = 'カメラ開始';
          }
        }
      }
    });
  }
  resetHL.addEventListener('click', ()=>{
    const spans = getWordSpans();
    spans.forEach((span, idx)=>{
      span.classList.remove('word--active', 'active');
      wordStates[idx] = 'pending';
      wordConfidence[idx] = defaultConfidenceForState('pending');
      applySpanState(span, 'pending', idx);
    });
    resetAllWordStates();
    currentWord = -1;
    lastMicIndex = -1;
    lastResultKey = '';
    lastSpeedNorm = '';
    unmatchedCount = 0;
    pendingGap = false;
    resetSpeedState();
  });
  recModeRadios.forEach(radio=>{
    radio.addEventListener('change', ()=>{
      if(!radio.checked) return;
      recognitionMode = radio.value;
      lastResultKey = '';
      lastSpeedNorm = '';
      unmatchedCount = 0;
      pendingGap = false;
      resetSpeedState();
      speedState.lastReliable = currentWord;
      speedState.anchor = currentWord;
      recStatus.textContent = recognitionMode === 'speed' ? '高速モード準備完了' : '正確モード準備完了';
    });
  });

  loadSample.addEventListener('click', ()=>{
    const sample = `Teacher: Today's unit question is "How do we make decisions?"\nYuna: We make decisions every day—what to wear, what to eat, what to watch.\nTeacher: Great. What kinds of factors affect our decisions?\nSophy: A big factor for me is my parents' opinions.\nTeacher: Often other people influence our choices. What else?\nMarcus: Sometimes we want to change or feel better about ourselves.`;
    textInput.value = sample; tokenize(sample); render();
  });

  // ====== Theme Toggle ======
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');
  
  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.textContent = '☀️';
      themeText.textContent = 'ライトモード';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.textContent = '🌙';
      themeText.textContent = 'ダークモード';
      localStorage.setItem('theme', 'light');
    }
    requestAnimationFrame(refreshConfidenceStyles);
  }
  
  // Load saved theme or detect system preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
  }
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  if(typeof window !== 'undefined'){
    window.karaokeEnglish = Object.assign({}, window.karaokeEnglish, {
      timingGenerator,
      refreshConfidenceStyles,
      lipSyncTracker,
      lipSyncState,
      async generateTimingsFromArrayBuffer(arrayBuffer, lyrics){
        const audioBuffer = await timingGenerator.decodeAudioData(arrayBuffer);
        return timingGenerator.generateTimingsFromAudio(audioBuffer, lyrics);
      }
    });
  }

  // 初期描画
  tokenize(''); render();
  reader.style.fontSize = '16px';
  reader.style.lineHeight = '1.7';
  recStatus.textContent = '準備完了';
