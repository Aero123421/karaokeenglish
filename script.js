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

  // ====== Confidence-Based Highlighting System ======
  class ConfidenceBasedHighlighter {
    constructor() {
      this.confidenceLevels = {
        veryLow:    { min: 0.0,  max: 0.3,  opacity: 0.5,  color: '#888888' },
        low:        { min: 0.3,  max: 0.5,  opacity: 0.7,  color: '#999999' },
        medium:     { min: 0.5,  max: 0.7,  opacity: 0.85, color: '#ffaa00' },
        high:       { min: 0.7,  max: 0.9,  opacity: 0.95, color: '#00ff00' },
        veryHigh:   { min: 0.9,  max: 1.0,  opacity: 1.0,  color: '#00ff00' }
      };
    }

    getConfidenceLevel(confidence) {
      for (const [key, level] of Object.entries(this.confidenceLevels)) {
        if (confidence >= level.min && confidence < level.max) {
          return level;
        }
      }
      return this.confidenceLevels.veryHigh;
    }

    applyConfidenceStyle(element, confidence) {
      const level = this.getConfidenceLevel(confidence);

      // GPU加速プロパティのみ使用（ぼかしなし）
      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'opacity, transform';

      // CSSカスタムプロパティで動的更新（ぼかしを削除）
      element.style.setProperty('--confidence-opacity', level.opacity);
      element.style.setProperty('--confidence-color', level.color);

      // GPU加速されたトランジション
      element.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

      // データ属性で信頼度レベルを設定
      if (confidence < 0.5) {
        element.setAttribute('data-confidence', 'low');
      } else if (confidence >= 0.7) {
        element.setAttribute('data-confidence', 'high');
      } else {
        element.setAttribute('data-confidence', 'medium');
      }
    }
  }

  // ====== GPU Optimized Animator ======
  class GPUOptimizedAnimator {
    constructor() {
      this.animationFrameId = null;
    }

    // コンポジットレイヤーを強制的に作成
    forceGPULayer(element) {
      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'transform, opacity';
      element.style.backfaceVisibility = 'hidden';
    }

    // バッチ処理でリフローを最小化
    batchUpdate(elements, updates) {
      // すべての読み取り操作を先に実行
      const measurements = elements.map(el => ({
        element: el,
        rect: el.getBoundingClientRect(),
        computed: window.getComputedStyle(el)
      }));

      // FastDOMパターン: 書き込みをrAFでバッチ化
      requestAnimationFrame(() => {
        measurements.forEach((item, index) => {
          const update = updates[index];
          if (!update) return;
          // transformとopacityのみ変更（リフロー回避）
          if (update.transform) item.element.style.transform = update.transform;
          if (update.opacity !== undefined) item.element.style.opacity = update.opacity;
        });
      });
    }
  }

  // ====== Confidence Interpolator ======
  class ConfidenceInterpolator {
    constructor() {
      this.history = [];
      this.maxHistorySize = 10;
    }

    // 移動平均で信頼度を平滑化
    smoothConfidence(currentConfidence) {
      this.history.push(currentConfidence);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }

      const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;
      return avg;
    }

    // カルマンフィルタで予測
    predictNextConfidence(observations) {
      if (!observations || observations.length === 0) return 0.5;

      let estimate = observations[0];
      let uncertainty = 1.0;
      const processNoise = 0.01;
      const measurementNoise = 0.1;

      for (const observation of observations) {
        // 予測ステップ
        uncertainty += processNoise;

        // 更新ステップ
        const gain = uncertainty / (uncertainty + measurementNoise);
        estimate = estimate + gain * (observation - estimate);
        uncertainty = (1 - gain) * uncertainty;
      }

      return estimate;
    }

    // 視覚的に違和感のない補間
    interpolateVisualFeedback(prevState, currentState, confidence) {
      const interpolationFactor = Math.min(confidence, 0.8);

      return {
        opacity: this.lerp(prevState.opacity, currentState.opacity, interpolationFactor),
        scale: this.lerp(prevState.scale, currentState.scale, interpolationFactor),
        blur: this.lerp(prevState.blur, currentState.blur, interpolationFactor)
      };
    }

    lerp(start, end, factor) {
      return start + (end - start) * factor;
    }

    reset() {
      this.history = [];
    }
  }

  // ====== Lightweight Timing Generator ======
  class LightweightTimingGenerator {
    constructor() {
      this.audioContext = null;
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('AudioContext not available', e);
      }
    }

    // シンプルな均等配分アルゴリズム
    mapWordsToTimings(words, duration) {
      const avgWordDuration = duration / words.length;
      const timings = [];

      words.forEach((word, index) => {
        timings.push({
          word: word,
          start: index * avgWordDuration,
          end: (index + 1) * avgWordDuration,
          confidence: 0.7 // 初期信頼度
        });
      });

      return timings;
    }

    getCurrentTime() {
      return this.audioContext ? this.audioContext.currentTime : Date.now() / 1000;
    }
  }

  // ====== DOM Elements Cache ======
  const textInput = document.getElementById('textInput');
  const reader = document.getElementById('reader');
  const loadSample = document.getElementById('loadSample');
  const resetHL = document.getElementById('resetHL');
  const recLangRadios = Array.from(document.querySelectorAll('input[name="recLang"]'));
  const langToggleEl = document.querySelector('.lang-toggle');
  const langSliderEl = langToggleEl?.querySelector('.lang-toggle__slider');
  const recStatus = document.getElementById('recStatus');

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

  // ====== Lightweight Processing Algorithm Instances ======
  const confidenceHighlighter = new ConfidenceBasedHighlighter();
  const gpuAnimator = new GPUOptimizedAnimator();
  const confidenceInterpolator = new ConfidenceInterpolator();
  const timingGenerator = new LightweightTimingGenerator();

  // ====== ユーティリティ ======
  function normalizeForMatch(str){
    try{
      return str.toLowerCase().replace(/[\u2019\u2018]/g, "'")
        .replace(/[^\p{L}\p{N}'\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
    }catch(e){
      return str.toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').replace(/\s+/g, ' ').trim();
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
  }

  function render(){
    const frag = document.createDocumentFragment();
    tokens.forEach((tok, k)=>{
      if(tok.type === 'word'){
        const span = document.createElement('span');
        span.className = 'word';
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
    spans.forEach((span, idx)=>{
      applySpanState(span, wordStates[idx] || 'pending');
      // GPU最適化を全単語に適用
      gpuAnimator.forceGPULayer(span);
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

  function applySpanState(span, state){
    span.classList.toggle('word--matched', state === 'matched');
    span.classList.toggle('word--missed', state === 'missed');
    span.classList.toggle('word--pending', state === 'pending');
  }

  function updateWordState(index, state, spans){
    if(index < 0 || index >= wordStates.length) return;
    wordStates[index] = state;
    const list = spans || getWordSpans();
    const span = list[index];
    if(span) applySpanState(span, state);
  }

  function updateWordStateRange(from, to, state, spans){
    if(!wordStates.length) return;
    const list = spans || getWordSpans();
    const start = Math.max(0, from);
    const end = Math.min(wordStates.length - 1, to);
    if(end < start) return;
    for(let i=start; i<=end; i++){
      wordStates[i] = state;
      const span = list[i];
      if(span) applySpanState(span, state);
    }
  }

  function resetAllWordStates(){
    wordStates = new Array(normalizedWords.length).fill('pending');
    const spans = getWordSpans();
    spans.forEach(span=>applySpanState(span, 'pending'));
    updateProgressIndicator();
  }

  function resetSpeedState(){
    speedState = { history: [], map: [], lastReliable: -1, anchor: -1, missCount: 0, stability: 0, lastInputTs: 0, lastEmitTs: 0 };
    confidenceInterpolator.reset();
    updateRealtimeTelemetry();
  }

  function rewindHighlight(targetIndex){
    const spans = getWordSpans();
    const clamped = Math.min(Math.max(targetIndex, -1), spans.length - 1);
    for(let i=clamped + 1; i<wordStates.length; i++){
      if(wordStates[i] !== 'pending'){
        wordStates[i] = 'pending';
      }
      const span = spans[i];
      if(span){
        applySpanState(span, 'pending');
        span.classList.remove('word--active', 'active');
      }
    }
    if(currentWord >= 0 && currentWord < spans.length){
      spans[currentWord].classList.remove('word--active', 'active');
    }
    currentWord = clamped;
    lastMicIndex = clamped;
    if(clamped >= 0){
      spans[clamped].classList.add('word--active', 'active');
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

  function processSpeedRecognition(parts, hasFinal){
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

    const prevHistory = speedState.history;
    const prevMap = speedState.map;
    const maxPrefix = Math.min(prevHistory.length, parts.length);
    let prefix = 0;
    while(prefix < maxPrefix && prevHistory[prefix] === parts[prefix]) prefix++;

    // 巻き戻しを最小化：確定結果でかつ大幅な不一致の場合のみ
    // 暫定結果では巻き戻しを行わない（前方進行のみ）
    const shouldRollback = hasFinal && prefix < prevHistory.length && prefix < prevHistory.length * 0.3;

    if(shouldRollback){
      // 確定結果で30%以下しか一致しない場合のみ巻き戻し
      const rollbackIndex = prefix > 0 ? prevMap[prefix - 1] : -1;
      highlightTo(rollbackIndex, { outcome:'rollback' });
      speedState.anchor = rollbackIndex;
      speedState.lastReliable = rollbackIndex;
      speedState.missCount = 0;
      speedState.map = prevMap.slice(0, prefix);
      speedState.history = prevHistory.slice(0, prefix);
    }else{
      // 巻き戻しせずに前方進行を継続
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
        // 前方進行のみを許可：現在位置より後ろのみ
        if(candidate.index > anchor || (anchor === -1 && candidate.index >= 0)){
          const strongThreshold = hasFinal ? 1.05 : 1.35;
          const softThreshold = hasFinal ? 0.85 : 1.1;
          let outcome = 'match';
          let markSkipped = candidate.quality >= strongThreshold;
          if(candidate.quality < softThreshold){
            outcome = 'skip';
            markSkipped = false;
          }
          highlightTo(candidate.index, { outcome, markSkipped });
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
          // 後退するマッチングは無視（前方進行優先）
          speedState.map[idx] = -1;
        }
      }else{
        speedState.map[idx] = -1;
        speedState.missCount = (speedState.missCount || 0) + 1;
        speedState.stability = Math.max(0, speedState.stability * 0.6 - 0.12);
        // 暫定結果ではフォールバックを緩く、確定結果では厳しく
        if(speedState.missCount >= (hasFinal ? 3 : 5)){
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
      // フォールバックも前方進行のみ：現在位置より後ろのみ許可
      if(alignment && typeof alignment.bestIndex === 'number' && alignment.bestIndex > anchor){
        highlightTo(alignment.bestIndex, { outcome:'match' });
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
    const { manual = false, outcome = 'match', markSkipped = true, confidence = 0.7 } = options;
    const wordSpans = getWordSpans();
    if(outcome === 'rollback' && !manual){
      rewindHighlight(index);
      pendingGap = false;
      unmatchedCount = 0;
      return;
    }
    if(index < 0 || index >= wordSpans.length) return;
    if(!manual){
      const prev = currentWord;
      if(outcome === 'match'){
        if(markSkipped){
          const start = prev >= 0 ? prev + 1 : 0;
          if(index - start > 0){
            updateWordStateRange(start, index - 1, 'missed', wordSpans);
          }
        }
        updateWordState(index, 'matched', wordSpans);
        speedState.lastReliable = Math.max(speedState.lastReliable, index);

        // 信頼度に基づいたスタイルを適用
        confidenceHighlighter.applyConfidenceStyle(wordSpans[index], confidence);
      }else if(outcome === 'skip'){
        if(markSkipped){
          const from = prev < index ? prev + 1 : index;
          updateWordStateRange(from, index, 'missed', wordSpans);
        }
      }
    }
    if(currentWord >= 0 && currentWord < wordSpans.length){
      wordSpans[currentWord].classList.remove('word--active', 'active');
    }
    wordSpans[index].classList.add('word--active', 'active');
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

  // Jaro-Winkler類似度計算（軽量・高精度）
  function jaroWinkler(s1, s2){
    if(s1 === s2) return 1.0;
    const len1 = s1.length, len2 = s2.length;
    if(len1 === 0 || len2 === 0) return 0;

    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    let matches = 0;

    for(let i = 0; i < len1; i++){
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);
      for(let j = start; j < end; j++){
        if(s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if(matches === 0) return 0;

    let transpositions = 0;
    let k = 0;
    for(let i = 0; i < len1; i++){
      if(!s1Matches[i]) continue;
      while(!s2Matches[k]) k++;
      if(s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Winklerボーナス（プレフィックス一致）
    let prefix = 0;
    for(let i = 0; i < Math.min(4, Math.min(len1, len2)); i++){
      if(s1[i] === s2[i]) prefix++; else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  function scoreWordMatch(a,b){
    if(!a || !b) return -100;
    if(a === b) return 3;

    // プレフィックス一致（高速）
    if(a.startsWith(b) || b.startsWith(a)) return 2;

    // Levenshtein距離（メイン判定）
    const dist = levenshtein(a,b);
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);

    if(dist === 1) return 2;
    if(dist === 2 && minLen > 4) return 1.5;
    if(dist <= Math.ceil(minLen / 2) && minLen >= 6) return 1;

    // Jaro-Winkler（補助判定・慎重な閾値）
    if(maxLen >= 4){
      const similarity = jaroWinkler(a, b);
      // 非常に保守的な閾値：誤マッチを防ぐ
      if(similarity >= 0.9) return 1.2;   // 90%以上の高い類似度のみ
      if(similarity >= 0.85) return 0.8;  // 85%以上で弱い一致
    }

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
    let totalConfidence = 0;
    let confidenceCount = 0;

    // 信頼度を取得
    for(let i=ev.resultIndex; i<ev.results.length; i++){
      transcript += ev.results[i][0].transcript;
      if(ev.results[i].isFinal) hasFinal = true;

      // confidence値を収集
      if(ev.results[i][0].confidence !== undefined) {
        totalConfidence += ev.results[i][0].confidence;
        confidenceCount++;
      }
    }

    // 平均信頼度を計算
    const rawConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;

    // 信頼度補間システムで平滑化
    const smoothedConfidence = confidenceInterpolator.smoothConfidence(rawConfidence);

    const norm = normalizeForMatch(transcript);
    if(!norm){
      recStatus.textContent = '聞き取り中: ' + transcript + ` (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`;
      return;
    }
    const parts = norm.split(' ').filter(Boolean);
    if(parts.length === 0){
      recStatus.textContent = '聞き取り中: ' + transcript + ` (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`;
      return;
    }

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
      processSpeedRecognition(parts, hasFinal);
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
          highlightTo(globalIndex, { outcome: 'match', confidence: smoothedConfidence });
        }else if(hasFinal && normalizedWords.length){
          const softAdvance = Math.min((currentWord === -1 ? 0 : currentWord + 1), normalizedWords.length - 1);
          if(softAdvance > currentWord){
            highlightTo(softAdvance, { outcome: 'skip', markSkipped:false, confidence: smoothedConfidence });
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

    recStatus.textContent = (hasFinal ? '認識: ' : '聞き取り中: ') + transcript + ` (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`;
  }
  function micStop(){
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
    confidenceInterpolator.reset();
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
  resetHL.addEventListener('click', ()=>{
    const spans = getWordSpans();
    spans.forEach(span=>{
      span.classList.remove('word--active', 'active');
      applySpanState(span, 'pending');
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

  // 初期描画
  tokenize(''); render();
  reader.style.fontSize = '16px';
  reader.style.lineHeight = '1.7';
  recStatus.textContent = '準備完了';
