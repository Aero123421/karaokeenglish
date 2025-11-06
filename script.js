  const textInput = document.getElementById('textInput');
  const reader = document.getElementById('reader');
  const loadSample = document.getElementById('loadSample');
  const resetHL = document.getElementById('resetHL');
  const recLangRadios = Array.from(document.querySelectorAll('input[name="recLang"]'));
  const langToggleEl = document.querySelector('.lang-toggle');
  const langSliderEl = langToggleEl ? langToggleEl.querySelector('.lang-toggle__slider') : null;
  const recStatus = document.getElementById('recStatus');
  const updateLangSlider = () => {
    if (!langToggleEl || !langSliderEl) return;
    const activeInput = langToggleEl.querySelector('input[type="radio"]:checked');
    if (!activeInput) return;
    const activeLabel = langToggleEl.querySelector(`label[for="${activeInput.id}"]`);
    if (!activeLabel) return;
    const langRect = langToggleEl.getBoundingClientRect();
    const labelRect = activeLabel.getBoundingClientRect();
    if (!labelRect.width) return;
    const styles = getComputedStyle(langToggleEl);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
    const offset = labelRect.left - langRect.left - borderLeft - paddingLeft;
    langToggleEl.style.setProperty('--slider-offset', `${offset}px`);
    langToggleEl.style.setProperty('--slider-width', `${labelRect.width}px`);
  };
  if (langToggleEl && langSliderEl) {
    const scheduleLangSlider = () => requestAnimationFrame(updateLangSlider);
    scheduleLangSlider();
    recLangRadios.forEach(input => {
      input.addEventListener('change', scheduleLangSlider);
      input.addEventListener('focus', scheduleLangSlider);
    });
    window.addEventListener('resize', scheduleLangSlider);
  }

  if (langToggleEl && langSliderEl) {
    const langOptions = Array.from(langToggleEl.querySelectorAll('.lang-toggle__option'));
    const langDragState = { active:false, pointerId:null, rect:null, paddingLeft:0, paddingRight:0, borderLeft:0, borderRight:0, hover:null };

    const ensureMetrics = () => {
      langDragState.rect = langToggleEl.getBoundingClientRect();
      const styles = getComputedStyle(langToggleEl);
      langDragState.paddingLeft = parseFloat(styles.paddingLeft) || 0;
      langDragState.paddingRight = parseFloat(styles.paddingRight) || 0;
      langDragState.borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      langDragState.borderRight = parseFloat(styles.borderRightWidth) || 0;
    };

    const commitOption = (label) => {
      if(!label) return;
      const id = label.getAttribute('for');
      if(!id) return;
      const input = langToggleEl.querySelector(`#${id}`);
      if(input && !input.checked){
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }
    };

    const updateDragVisual = (clientX, commit = false) => {
      if(!langDragState.rect) ensureMetrics();
      const { rect, paddingLeft, paddingRight, borderLeft, borderRight } = langDragState;
      if(!rect) return;
      const innerWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
      if(innerWidth <= 0) return;
      let x = clientX - rect.left - borderLeft - paddingLeft;
      x = Math.max(0, Math.min(innerWidth, x));
      let closestLabel = null;
      let minDist = Infinity;
      langOptions.forEach(label => {
        const optionRect = label.getBoundingClientRect();
        const center = optionRect.left - rect.left - borderLeft - paddingLeft + optionRect.width / 2;
        const dist = Math.abs(center - x);
        if(dist < minDist){
          minDist = dist;
          closestLabel = label;
        }
      });
      if(!closestLabel) return;
      if(langDragState.hover && langDragState.hover !== closestLabel){
        langDragState.hover.classList.remove('is-hovered');
      }
      closestLabel.classList.add('is-hovered');
      langDragState.hover = closestLabel;
      const optionRect = closestLabel.getBoundingClientRect();
      const sliderWidth = optionRect.width;
      const maxOffset = Math.max(0, innerWidth - sliderWidth);
      const offset = Math.max(0, Math.min(x - sliderWidth / 2, maxOffset));
      langToggleEl.style.setProperty('--slider-width', `${sliderWidth}px`);
      langToggleEl.style.setProperty('--slider-offset', `${offset}px`);
      if(commit){
        commitOption(closestLabel);
        requestAnimationFrame(updateLangSlider);
      }
    };

    const finishDrag = () => {
      if(langDragState.pointerId !== null){
        try{ langToggleEl.releasePointerCapture(langDragState.pointerId); }catch(_err){}
      }
      langDragState.pointerId = null;
      langDragState.active = false;
      langToggleEl.classList.remove('lang-toggle--dragging');
      if(langDragState.hover){
        langDragState.hover.classList.remove('is-hovered');
        langDragState.hover = null;
      }
      langDragState.rect = null;
      requestAnimationFrame(updateLangSlider);
    };

    let langSwipeStart = 0;
    const handlePointerMove = (ev) => {
      if(!langDragState.active || (langDragState.pointerId !== null && ev.pointerId !== langDragState.pointerId)) return;
      updateDragVisual(ev.clientX, false);
      
      // Track swipe for navigation
      const delta = ev.clientX - langSwipeStart;
      if(Math.abs(delta) > 50){
        const currentIndex = recLangRadios.findIndex(r => r.checked);
        if(delta > 0 && currentIndex > 0){
          // Swipe right: previous option
          recLangRadios[currentIndex - 1].checked = true;
          recLangRadios[currentIndex - 1].dispatchEvent(new Event('change', {bubbles: true}));
          langSwipeStart = ev.clientX;
        } else if(delta < 0 && currentIndex < recLangRadios.length - 1){
          // Swipe left: next option
          recLangRadios[currentIndex + 1].checked = true;
          recLangRadios[currentIndex + 1].dispatchEvent(new Event('change', {bubbles: true}));
          langSwipeStart = ev.clientX;
        }
      }
    };

    const handlePointerUp = (ev) => {
      if(!langDragState.active || (langDragState.pointerId !== null && ev.pointerId !== langDragState.pointerId)) return;
      updateDragVisual(ev.clientX, true);
      if(langSliderEl){
        langSliderEl.style.transform = '';
      }
      finishDrag();
    };

    langToggleEl.addEventListener('pointerdown', (ev) => {
      if(ev.pointerType === 'mouse' && ev.button !== 0) return;
      const optionLabel = ev.target.closest('label.lang-toggle__option');
      if(ev.pointerType === 'mouse' && optionLabel && langToggleEl.contains(optionLabel)){
        return;
      }
      ensureMetrics();
      langDragState.active = true;
      langDragState.pointerId = ev.pointerId;
      langSwipeStart = ev.clientX;
      langToggleEl.classList.add('lang-toggle--dragging');
      try{ langToggleEl.setPointerCapture(ev.pointerId); }catch(_err){}
      updateDragVisual(ev.clientX, false);
      if(ev.pointerType !== 'mouse'){
        ev.preventDefault();
      }
    });
    langToggleEl.addEventListener('pointermove', handlePointerMove);
    langToggleEl.addEventListener('pointerup', handlePointerUp);
    langToggleEl.addEventListener('pointercancel', handlePointerUp);
    langToggleEl.addEventListener('lostpointercapture', finishDrag);
  }
  const getSelectedLang = () => {
    const active = recLangRadios.find(input => input.checked);
    return active ? active.value : 'en-US';
  };
  const btnMicStart = document.getElementById('btnMicStart');
  const btnMicStop = document.getElementById('btnMicStop');
  
  // Scroll toggle (auto/manual)
  const scrollModeRadios = Array.from(document.querySelectorAll('input[name="scrollMode"]'));
  const scrollToggleEl = document.querySelector('.scroll-toggle');
  const scrollSliderEl = scrollToggleEl ? scrollToggleEl.querySelector('.scroll-toggle__slider') : null;
  let autoScrollEnabled = true;
  
  const updateScrollSlider = () => {
    if (!scrollToggleEl || !scrollSliderEl) return;
    const activeInput = scrollToggleEl.querySelector('input[type="radio"]:checked');
    if (!activeInput) return;
    const activeLabel = scrollToggleEl.querySelector(`label[for="${activeInput.id}"]`);
    if (!activeLabel) return;
    const scrollRect = scrollToggleEl.getBoundingClientRect();
    const labelRect = activeLabel.getBoundingClientRect();
    if (!labelRect.width) return;
    const styles = getComputedStyle(scrollToggleEl);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
    const offset = labelRect.left - scrollRect.left - borderLeft - paddingLeft;
    scrollToggleEl.style.setProperty('--scroll-slider-offset', `${offset}px`);
    scrollToggleEl.style.setProperty('--scroll-slider-width', `${labelRect.width}px`);
  };
  
  if (scrollToggleEl && scrollSliderEl) {
    const scheduleScrollSlider = () => requestAnimationFrame(updateScrollSlider);
    scheduleScrollSlider();
    scrollModeRadios.forEach(input => {
      input.addEventListener('change', () => {
        autoScrollEnabled = input.value === 'auto';
        scheduleScrollSlider();
      });
      input.addEventListener('focus', scheduleScrollSlider);
    });
    window.addEventListener('resize', scheduleScrollSlider);
    
    // Draggable scroll toggle
    const scrollOptions = Array.from(scrollToggleEl.querySelectorAll('.scroll-toggle__option'));
    const scrollDragState = { active:false, pointerId:null, rect:null, paddingLeft:0, paddingRight:0, borderLeft:0, borderRight:0, hover:null };

    const ensureScrollMetrics = () => {
      scrollDragState.rect = scrollToggleEl.getBoundingClientRect();
      const styles = getComputedStyle(scrollToggleEl);
      scrollDragState.paddingLeft = parseFloat(styles.paddingLeft) || 0;
      scrollDragState.paddingRight = parseFloat(styles.paddingRight) || 0;
      scrollDragState.borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      scrollDragState.borderRight = parseFloat(styles.borderRightWidth) || 0;
    };

    const commitScrollOption = (label) => {
      if(!label) return;
      const id = label.getAttribute('for');
      if(!id) return;
      const input = scrollToggleEl.querySelector(`#${id}`);
      if(input && !input.checked){
        input.checked = true;
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }
    };

    const updateScrollDragVisual = (clientX, commit = false) => {
      if(!scrollDragState.rect) ensureScrollMetrics();
      const { rect, paddingLeft, paddingRight, borderLeft, borderRight } = scrollDragState;
      if(!rect) return;
      const innerWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
      if(innerWidth <= 0) return;
      let x = clientX - rect.left - borderLeft - paddingLeft;
      x = Math.max(0, Math.min(innerWidth, x));
      let closestLabel = null;
      let minDist = Infinity;
      scrollOptions.forEach(label => {
        const optionRect = label.getBoundingClientRect();
        const center = optionRect.left - rect.left - borderLeft - paddingLeft + optionRect.width / 2;
        const dist = Math.abs(center - x);
        if(dist < minDist){
          minDist = dist;
          closestLabel = label;
        }
      });
      if(!closestLabel) return;
      if(scrollDragState.hover && scrollDragState.hover !== closestLabel){
        scrollDragState.hover.classList.remove('is-hovered');
      }
      closestLabel.classList.add('is-hovered');
      scrollDragState.hover = closestLabel;
      const optionRect = closestLabel.getBoundingClientRect();
      const sliderWidth = optionRect.width;
      const maxOffset = Math.max(0, innerWidth - sliderWidth);
      const offset = Math.max(0, Math.min(x - sliderWidth / 2, maxOffset));
      scrollToggleEl.style.setProperty('--scroll-slider-width', `${sliderWidth}px`);
      scrollToggleEl.style.setProperty('--scroll-slider-offset', `${offset}px`);
      if(commit){
        commitScrollOption(closestLabel);
        requestAnimationFrame(updateScrollSlider);
      }
    };

    const finishScrollDrag = () => {
      if(scrollDragState.pointerId !== null){
        try{ scrollToggleEl.releasePointerCapture(scrollDragState.pointerId); }catch(_err){}
      }
      scrollDragState.pointerId = null;
      scrollDragState.active = false;
      scrollToggleEl.classList.remove('scroll-toggle--dragging');
      if(scrollDragState.hover){
        scrollDragState.hover.classList.remove('is-hovered');
        scrollDragState.hover = null;
      }
      scrollDragState.rect = null;
      requestAnimationFrame(updateScrollSlider);
    };

    const handleScrollPointerMove = (ev) => {
      if(!scrollDragState.active || (scrollDragState.pointerId !== null && ev.pointerId !== scrollDragState.pointerId)) return;
      updateScrollDragVisual(ev.clientX, false);
    };

    const handleScrollPointerUp = (ev) => {
      if(!scrollDragState.active || (scrollDragState.pointerId !== null && ev.pointerId !== scrollDragState.pointerId)) return;
      updateScrollDragVisual(ev.clientX, true);
      if(scrollSliderEl){
        scrollSliderEl.style.transform = '';
      }
      finishScrollDrag();
    };

    scrollToggleEl.addEventListener('pointerdown', (ev) => {
      if(ev.pointerType === 'mouse' && ev.button !== 0) return;
      const optionLabel = ev.target.closest('label.scroll-toggle__option');
      if(ev.pointerType === 'mouse' && optionLabel && scrollToggleEl.contains(optionLabel)){
        return;
      }
      ensureScrollMetrics();
      scrollDragState.active = true;
      scrollDragState.pointerId = ev.pointerId;
      scrollToggleEl.classList.add('scroll-toggle--dragging');
      try{ scrollToggleEl.setPointerCapture(ev.pointerId); }catch(_err){}
      updateScrollDragVisual(ev.clientX, false);
      if(ev.pointerType !== 'mouse'){
        ev.preventDefault();
      }
    });
    scrollToggleEl.addEventListener('pointermove', handleScrollPointerMove);
    scrollToggleEl.addEventListener('pointerup', handleScrollPointerUp);
    scrollToggleEl.addEventListener('pointercancel', handleScrollPointerUp);
    scrollToggleEl.addEventListener('lostpointercapture', finishScrollDrag);
  }
  const recModeRadios = Array.from(document.querySelectorAll('input[name=\"recMode\"]'));
  const modeToggleEl = document.querySelector('.mode-toggle');
  const modeSliderEl = modeToggleEl ? modeToggleEl.querySelector('.mode-toggle__slider') : null;
  
  const updateModeSlider = () => {
    if (!modeToggleEl || !modeSliderEl) return;
    const activeInput = modeToggleEl.querySelector('input[type="radio"]:checked');
    if (!activeInput) return;
    const activeLabel = modeToggleEl.querySelector(`label[for="${activeInput.id}"]`);
    if (!activeLabel) return;
    const modeRect = modeToggleEl.getBoundingClientRect();
    const labelRect = activeLabel.getBoundingClientRect();
    if (!labelRect.width) return;
    const styles = getComputedStyle(modeToggleEl);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
    const offset = labelRect.left - modeRect.left - borderLeft - paddingLeft;
    modeToggleEl.style.setProperty('--mode-slider-offset', `${offset}px`);
    modeToggleEl.style.setProperty('--mode-slider-width', `${labelRect.width}px`);
  };
  if (modeToggleEl && modeSliderEl) {
    const scheduleModeSlider = () => requestAnimationFrame(updateModeSlider);
    scheduleModeSlider();
    recModeRadios.forEach(input => {
      input.addEventListener('change', scheduleModeSlider);
      input.addEventListener('focus', scheduleModeSlider);
    });
    window.addEventListener('resize', scheduleModeSlider);
    
    // Draggable mode toggle with pointer tracking (same as language)
    const modeOptions = Array.from(modeToggleEl.querySelectorAll('.mode-toggle__option'));
    const modeDragState = { active:false, pointerId:null, rect:null, paddingLeft:0, paddingRight:0, borderLeft:0, borderRight:0, hover:null };

    const ensureModeMetrics = () => {
      modeDragState.rect = modeToggleEl.getBoundingClientRect();
      const styles = getComputedStyle(modeToggleEl);
      modeDragState.paddingLeft = parseFloat(styles.paddingLeft) || 0;
      modeDragState.paddingRight = parseFloat(styles.paddingRight) || 0;
      modeDragState.borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      modeDragState.borderRight = parseFloat(styles.borderRightWidth) || 0;
    };

    const commitModeOption = (label) => {
      if(!label) return;
      const id = label.getAttribute('for');
      if(!id) return;
      const input = modeToggleEl.querySelector(`#${id}`);
      if(input && !input.checked){
        input.checked = true;
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }
    };

    const updateModeDragVisual = (clientX, commit = false) => {
      if(!modeDragState.rect) ensureModeMetrics();
      const { rect, paddingLeft, paddingRight, borderLeft, borderRight } = modeDragState;
      if(!rect) return;
      const innerWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
      if(innerWidth <= 0) return;
      let x = clientX - rect.left - borderLeft - paddingLeft;
      x = Math.max(0, Math.min(innerWidth, x));
      let closestLabel = null;
      let minDist = Infinity;
      modeOptions.forEach(label => {
        const optionRect = label.getBoundingClientRect();
        const center = optionRect.left - rect.left - borderLeft - paddingLeft + optionRect.width / 2;
        const dist = Math.abs(center - x);
        if(dist < minDist){
          minDist = dist;
          closestLabel = label;
        }
      });
      if(!closestLabel) return;
      if(modeDragState.hover && modeDragState.hover !== closestLabel){
        modeDragState.hover.classList.remove('is-hovered');
      }
      closestLabel.classList.add('is-hovered');
      modeDragState.hover = closestLabel;
      const optionRect = closestLabel.getBoundingClientRect();
      const sliderWidth = optionRect.width;
      const maxOffset = Math.max(0, innerWidth - sliderWidth);
      const offset = Math.max(0, Math.min(x - sliderWidth / 2, maxOffset));
      modeToggleEl.style.setProperty('--mode-slider-width', `${sliderWidth}px`);
      modeToggleEl.style.setProperty('--mode-slider-offset', `${offset}px`);
      if(commit){
        commitModeOption(closestLabel);
        requestAnimationFrame(updateModeSlider);
      }
    };

    const finishModeDrag = () => {
      if(modeDragState.pointerId !== null){
        try{ modeToggleEl.releasePointerCapture(modeDragState.pointerId); }catch(_err){}
      }
      modeDragState.pointerId = null;
      modeDragState.active = false;
      modeToggleEl.classList.remove('mode-toggle--dragging');
      if(modeDragState.hover){
        modeDragState.hover.classList.remove('is-hovered');
        modeDragState.hover = null;
      }
      modeDragState.rect = null;
      requestAnimationFrame(updateModeSlider);
    };

    const handleModePointerMove = (ev) => {
      if(!modeDragState.active || (modeDragState.pointerId !== null && ev.pointerId !== modeDragState.pointerId)) return;
      updateModeDragVisual(ev.clientX, false);
    };

    const handleModePointerUp = (ev) => {
      if(!modeDragState.active || (modeDragState.pointerId !== null && ev.pointerId !== modeDragState.pointerId)) return;
      updateModeDragVisual(ev.clientX, true);
      if(modeSliderEl){
        modeSliderEl.style.transform = '';
      }
      finishModeDrag();
    };

    modeToggleEl.addEventListener('pointerdown', (ev) => {
      if(ev.pointerType === 'mouse' && ev.button !== 0) return;
      const optionLabel = ev.target.closest('label.mode-toggle__option');
      if(ev.pointerType === 'mouse' && optionLabel && modeToggleEl.contains(optionLabel)){
        return;
      }
      ensureModeMetrics();
      modeDragState.active = true;
      modeDragState.pointerId = ev.pointerId;
      modeToggleEl.classList.add('mode-toggle--dragging');
      try{ modeToggleEl.setPointerCapture(ev.pointerId); }catch(_err){}
      updateModeDragVisual(ev.clientX, false);
      if(ev.pointerType !== 'mouse'){
        ev.preventDefault();
      }
    });
    modeToggleEl.addEventListener('pointermove', handleModePointerMove);
    modeToggleEl.addEventListener('pointerup', handleModePointerUp);
    modeToggleEl.addEventListener('pointercancel', handleModePointerUp);
    modeToggleEl.addEventListener('lostpointercapture', finishModeDrag);
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
    const { manual = false, outcome = 'match', markSkipped = true } = options;
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
      highlightTo(targetIndex, { outcome: 'match' });
    }else{
      unmatchedCount++;
      const needsRecovery = hasFinal || unmatchedCount >= 2 || pendingGap;
      if(needsRecovery){
        const globalIndex = findBestGlobalMatch(parts, Math.max(currentWord, lastMicIndex));
        if(globalIndex !== -1 && (globalIndex >= currentWord || currentWord === -1)){
          highlightTo(globalIndex, { outcome: 'match' });
        }else if(hasFinal && normalizedWords.length){
          const softAdvance = Math.min((currentWord === -1 ? 0 : currentWord + 1), normalizedWords.length - 1);
          if(softAdvance > currentWord){
            highlightTo(softAdvance, { outcome: 'skip', markSkipped:false });
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
