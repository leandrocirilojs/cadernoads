/**
 * hand-control.js
 * -----------------------------------------------------------------------
 * Módulo plugável de controle da página por reconhecimento de mão (câmera).
 * Não depende do restante do projeto — basta incluir com:
 *
 *   <script src="hand-control.js"></script>
 *
 * antes do </body>, depois do seu script.js.
 *
 * O que ele faz:
 *  - Roda a câmera escondida (invisível), cobrindo a tela toda internamente
 *    apenas para referência de coordenadas.
 *  - Mostra um cursor virtual (bolinha azul) que segue o CENTRO DA PALMA da
 *    mão (não a ponta de um dedo) — assim a posição não pula quando os
 *    dedos dobram para fazer o gesto de clique.
 *  - Clique/arrasto: feche a mão (punho) para "apertar o botão do mouse" na
 *    posição atual do cursor. Fechar e abrir rápido = clique; fechar e
 *    mover a mão = arrasto real (mousedown/mousemove/mouseup).
 *  - Um pequeno HUD no canto liga/desliga a câmera e mostra um preview de
 *    depuração (PIP) opcional.
 * -----------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ---------- Config ajustável ----------
  const CONFIG = {
    // Suavização adaptativa: quando a mão se move devagar, suaviza mais forte
    // (menos tremor); quando se move rápido, suaviza menos (mais responsivo).
    minSmoothing: 0.12,
    maxSmoothing: 0.55,
    velocityRef: 0.06,

    // Detecção de punho fechado: conta quantos dos 4 dedos (indicador, médio,
    // anelar, mínimo) estão "curvados" (ponta mais perto do pulso do que a
    // junta do meio do próprio dedo). Histerese: precisa de mais dedos
    // curvados para ENTRAR no punho do que para continuar considerando
    // punho fechado — evita flicker quando um dedo fica na dúvida.
    fistEnterCount: 3,   // nº mínimo de dedos curvados p/ começar a considerar "punho"
    fistExitCount: 2,    // nº mínimo de dedos curvados p/ continuar sendo "punho"
    fistConfirmFrames: 3, // nº de frames consecutivos p/ confirmar a mudança de estado

    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,

    dragMoveThrottleMs: 16,   // ~60fps de mousemove durante o drag/hover

    modelAssetPath:
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    wasmPath:
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    visionBundle:
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  };

  // ---------- CSS injetado (não precisa tocar no style.css do projeto) ----------
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    #hc-camLayer{
      position: fixed; inset: 0; width: 100vw; height: 100vh;
      opacity: 0; pointer-events: none; z-index: -1;
    }
    #hc-camLayer video{
      position:absolute; inset:0; width:100%; height:100%;
      object-fit: cover; transform: scaleX(-1);
    }
    #hc-pip{
      position: fixed; bottom: 16px; right: 16px;
      width: 200px; aspect-ratio: 4/3;
      border: 1px solid rgba(26,115,232,0.35);
      border-radius: 8px; overflow: hidden; background: #000;
      z-index: 2147483000; box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      display: none;
    }
    #hc-pip.visible{ display:block; }
    #hc-pip video{
      position:absolute; inset:0; width:100%; height:100%;
      object-fit: cover; transform: scaleX(-1);
    }
    #hc-hud{
      position: fixed; bottom: 10px; left: 10px;
      z-index: 2147483000;
      display:flex; align-items:center; gap:8px;
      font-family: 'Roboto', Arial, sans-serif;
      font-size: 11px;
      background: rgba(255,255,255,0.95);
      border: 1px solid #dadce0;
      border-radius: 999px;
      padding: 6px 10px;
      box-shadow: 0 1px 3px rgba(60,64,67,0.3);
      color: #202124;
    }
    #hc-hud .hc-dot{
      width:7px; height:7px; border-radius:50%;
      background:#1a73e8; box-shadow:0 0 6px #1a73e8;
      animation: hc-pulse 1.6s ease-in-out infinite;
    }
    @keyframes hc-pulse{ 0%,100%{opacity:1;} 50%{opacity:0.3;} }
    #hc-hud button{
      font-family: inherit; font-size: 11px; font-weight:500;
      background: #f1f3f4; color:#1a73e8; border:none;
      padding: 5px 10px; border-radius: 999px; cursor:pointer;
    }
    #hc-hud button:hover{ background:#e8f0fe; }
    #hc-gate{
      position: fixed; inset:0;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap: 14px; z-index: 2147483600;
      background: rgba(255,255,255,0.97);
      font-family: 'Roboto', Arial, sans-serif;
      text-align:center; padding: 20px;
    }
    #hc-gate .hc-icon{ font-size: 38px; }
    #hc-gate p{ max-width: 380px; font-size:13px; line-height:1.6; color:#5f6368; margin:0; }
    #hc-gate button.hc-primary{
      font-family: inherit; background:#1a73e8; color:#fff; border:none;
      padding: 11px 24px; border-radius: 999px; font-size:13.5px; font-weight:500;
      cursor:pointer; box-shadow: 0 1px 3px rgba(60,64,67,0.3);
    }
    #hc-gate button.hc-primary:hover{ background:#1765cc; }
    #hc-gate button.hc-primary:disabled{ opacity:0.5; cursor:default; }
    #hc-gate .hc-err{ color:#d93025; font-size:11.5px; }
    #hc-cursor{
      position: fixed; width: 26px; height: 26px; border-radius: 50%;
      border: 2px solid #1a73e8;
      box-shadow: 0 0 10px rgba(26,115,232,0.7);
      pointer-events: none; transform: translate(-50%, -50%);
      z-index: 2147483647; display:none;
      transition: width 0.1s ease, height 0.1s ease, background 0.1s ease, border-color 0.1s ease;
    }
    #hc-cursor::after{
      content:""; position:absolute; left:50%; top:50%;
      width:3px; height:3px; background:#1a73e8; border-radius:50%;
      transform: translate(-50%,-50%);
    }
    #hc-cursor.hc-active{
      background: rgba(217,48,37,0.18); border-color:#d93025;
      width: 18px; height: 18px;
      box-shadow: 0 0 12px rgba(217,48,37,0.6);
    }
    #hc-cursor.hc-active::after{ background:#d93025; }
  `;
  document.head.appendChild(styleTag);

  // ---------- DOM injetado ----------
  const camLayer = document.createElement('div');
  camLayer.id = 'hc-camLayer';
  const video = document.createElement('video');
  video.id = 'hc-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  camLayer.appendChild(video);

  const pip = document.createElement('div');
  pip.id = 'hc-pip';
  const videoPip = document.createElement('video');
  videoPip.autoplay = true;
  videoPip.playsInline = true;
  videoPip.muted = true;
  pip.appendChild(videoPip);

  const hud = document.createElement('div');
  hud.id = 'hc-hud';
  hud.innerHTML = `
    <span class="hc-dot"></span>
    <span id="hc-status">mão: --</span>
    <button id="hc-togglePip">câmera</button>
    <button id="hc-toggleActive">ligar controle</button>
  `;

  const gate = document.createElement('div');
  gate.id = 'hc-gate';
  gate.innerHTML = `
    <div class="hc-icon">✊</div>
    <p>Isso vai ativar sua câmera para controlar o cursor com a mão.
    Mova a mão aberta para mover o cursor. Feche a mão (punho) para
    clicar; feche e mova a mão para arrastar itens.</p>
    <button class="hc-primary" id="hc-startBtn">Ativar controle por mão</button>
    <span class="hc-err" id="hc-errMsg"></span>
  `;

  const cursor = document.createElement('div');
  cursor.id = 'hc-cursor';

  document.body.appendChild(camLayer);
  document.body.appendChild(pip);
  document.body.appendChild(hud);
  document.body.appendChild(cursor);
  // gate só é anexado quando o usuário pede pra ligar (ver toggleActive)

  // ---------- Estado ----------
  let handLandmarker = null;
  let running = false;
  let modelReady = false;
  let smoothX = window.innerWidth / 2;
  let smoothY = window.innerHeight / 2;
  let lastMoveDispatch = 0;
  let prevRawX = null;   // última posição bruta (palma, não suavizada), p/ calcular velocidade
  let prevRawY = null;

  // Clique/arrasto via gesto de punho fechado
  let isFist = false;            // estado confirmado (usado para disparar mousedown/up)
  let fistCandidateState = false; // estado "cru" antes de confirmar por N frames
  let fistConfirmCounter = 0;
  let dragTarget = null;          // elemento onde o "mousedown" começou

  const statusEl = hud.querySelector('#hc-status');
  const togglePipBtn = hud.querySelector('#hc-togglePip');
  const toggleActiveBtn = hud.querySelector('#hc-toggleActive');

  togglePipBtn.addEventListener('click', () => {
    pip.classList.toggle('visible');
  });

  toggleActiveBtn.addEventListener('click', () => {
    if (running) {
      stopControl();
    } else {
      document.body.appendChild(gate);
      gate.querySelector('#hc-startBtn').onclick = startControl;
    }
  });

  // Segurança: se a janela perder o foco com a mão "fechada" (drag em
  // andamento), solta o clique para não travar um drag pra sempre.
  window.addEventListener('blur', () => {
    if (isFist && dragTarget) {
      fireMouseEvent('mouseup', smoothX, smoothY, dragTarget, 0);
      dragTarget = null;
      isFist = false;
      cursor.classList.remove('hc-active');
    }
  });

  // ---------- Disparo de eventos reais de mouse ----------
  function fireMouseEvent(type, x, y, target, buttonsOverride) {
    const el = target || document.elementFromPoint(x, y) || document.body;
    const buttons = typeof buttonsOverride === 'number'
      ? buttonsOverride
      : (type === 'mouseup' ? 0 : 1);
    const evt = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: buttons
    });
    el.dispatchEvent(evt);
    return el;
  }

  // ---------- Modelo ----------
  async function loadVisionModule() {
    return import(CONFIG.visionBundle);
  }

  async function initModel() {
    const { HandLandmarker, FilesetResolver } = await loadVisionModule();
    const filesetResolver = await FilesetResolver.forVisionTasks(CONFIG.wasmPath);
    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: CONFIG.modelAssetPath,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: CONFIG.minHandDetectionConfidence,
      minHandPresenceConfidence: CONFIG.minHandPresenceConfidence,
      minTrackingConfidence: CONFIG.minTrackingConfidence
    });
    modelReady = true;
  }

  async function startControl() {
    const startBtn = gate.querySelector('#hc-startBtn');
    const errMsg = gate.querySelector('#hc-errMsg');
    startBtn.disabled = true;
    startBtn.textContent = 'Iniciando...';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errMsg.textContent = 'Câmera indisponível: abra esta página via HTTPS ou http://localhost.';
      startBtn.disabled = false;
      startBtn.textContent = 'Ativar controle por mão';
      return;
    }

    try {
      if (!modelReady) await initModel();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      video.srcObject = stream;
      videoPip.srcObject = stream;
      await new Promise((res) => { video.onloadedmetadata = res; });
      video.play();
      videoPip.play();

      gate.remove();
      smoothX = window.innerWidth / 2;
      smoothY = window.innerHeight / 2;
      cursor.style.left = smoothX + 'px';
      cursor.style.top = smoothY + 'px';
      cursor.style.display = 'block';
      toggleActiveBtn.textContent = 'desligar controle';
      running = true;
      requestAnimationFrame(renderLoop);
    } catch (err) {
      console.error(err);
      errMsg.textContent = 'Erro ao acessar a câmera (' + err.message + ')';
      startBtn.disabled = false;
      startBtn.textContent = 'Ativar controle por mão';
    }
  }

  function stopControl() {
    running = false;
    cursor.style.display = 'none';
    cursor.classList.remove('hc-active');
    toggleActiveBtn.textContent = 'ligar controle';
    statusEl.textContent = 'mão: --';
    const stream = video.srcObject;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      videoPip.srcObject = null;
    }
    if (isFist && dragTarget) {
      fireMouseEvent('mouseup', smoothX, smoothY, dragTarget, 0);
    }
    isFist = false;
    dragTarget = null;
    fistCandidateState = false;
    fistConfirmCounter = 0;
    prevRawX = null;
    prevRawY = null;
  }

  // ---------- Loop principal ----------
  function renderLoop() {
    if (!running) return;

    try {
      processFrame();
    } catch (err) {
      // Um erro isolado num frame não deve derrubar o controle inteiro.
      console.error('hand-control: erro no frame, seguindo em frente:', err);
    }

    requestAnimationFrame(renderLoop);
  }

  // Conta quantos dos 4 dedos (fora o polegar) estão curvados: a ponta do
  // dedo (tip) fica mais perto do pulso do que a junta do meio (pip) dele
  // mesmo quando o dedo está dobrado — é um sinal robusto de "mão fechada"
  // mesmo com uma câmera de baixa qualidade, porque é um movimento grande.
  function countCurledFingers(lm, wrist) {
    const fingerJoints = [
      { tip: 8, pip: 6 },   // indicador
      { tip: 12, pip: 10 }, // médio
      { tip: 16, pip: 14 }, // anelar
      { tip: 20, pip: 18 }  // mínimo
    ];
    let curled = 0;
    for (const f of fingerJoints) {
      const tipDist = Math.hypot(lm[f.tip].x - wrist.x, lm[f.tip].y - wrist.y);
      const pipDist = Math.hypot(lm[f.pip].x - wrist.x, lm[f.pip].y - wrist.y);
      if (tipDist < pipDist) curled++;
    }
    return curled;
  }

  function processFrame() {
    const now = performance.now();

    if (video.readyState >= 2) {
      const results = handLandmarker.detectForVideo(video, now);

      if (results.landmarks && results.landmarks.length > 0) {
        const lm = results.landmarks[0];
        const wrist = lm[0];

        // --- Ponto rastreado: centro da palma (média de pulso + 4 bases
        // dos dedos), não a ponta de um dedo — permanece estável mesmo
        // quando a mão fecha para o gesto de clique. ---
        const palmX = (wrist.x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
        const palmY = (wrist.y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;

        // --- Detecção de punho com histerese ---
        const curledCount = countCurledFingers(lm, wrist);
        const rawFist = isFist
          ? curledCount >= CONFIG.fistExitCount
          : curledCount >= CONFIG.fistEnterCount;

        // --- Confirmação por N frames consecutivos (evita clique fantasma) ---
        if (rawFist === fistCandidateState) {
          fistConfirmCounter++;
        } else {
          fistCandidateState = rawFist;
          fistConfirmCounter = 1;
        }
        const fistNow = fistConfirmCounter >= CONFIG.fistConfirmFrames
          ? fistCandidateState
          : isFist;

        // --- Posição alvo (espelhada) ---
        const mirroredX = 1 - palmX;
        const targetX = mirroredX * window.innerWidth;
        const targetY = palmY * window.innerHeight;

        // --- Suavização adaptativa por velocidade ---
        let velocity = 0;
        if (prevRawX !== null) {
          const vNormX = Math.abs(mirroredX - prevRawX);
          const vNormY = Math.abs(palmY - prevRawY);
          velocity = Math.max(vNormX, vNormY);
        }
        prevRawX = mirroredX;
        prevRawY = palmY;

        const velocityFactor = Math.min(velocity / CONFIG.velocityRef, 1);
        const smoothing = CONFIG.minSmoothing +
          (CONFIG.maxSmoothing - CONFIG.minSmoothing) * velocityFactor;

        smoothX += (targetX - smoothX) * smoothing;
        smoothY += (targetY - smoothY) * smoothing;

        cursor.style.left = smoothX + 'px';
        cursor.style.top = smoothY + 'px';
        cursor.classList.toggle('hc-active', fistNow);
        statusEl.textContent = fistNow ? 'mão: fechada' : 'mão: aberta';

        // --- Transições de gesto -> eventos de mouse reais ---
        if (fistNow && !isFist) {
          // fechou a mão: início do "clique/arrasto"
          dragTarget = fireMouseEvent('mousedown', smoothX, smoothY, null, 1);
        } else if (fistNow && isFist) {
          // continua fechada: arrastando — dispara mousemove throttled no documento
          if (now - lastMoveDispatch > CONFIG.dragMoveThrottleMs) {
            fireMouseEvent('mousemove', smoothX, smoothY, document, 1);
            lastMoveDispatch = now;
          }
        } else if (!fistNow && isFist) {
          // abriu a mão: finaliza o drag e dispara click se foi um "tap" rápido
          const upTarget = document.elementFromPoint(smoothX, smoothY) || dragTarget;
          fireMouseEvent('mouseup', smoothX, smoothY, upTarget, 0);
          if (upTarget === dragTarget) {
            fireMouseEvent('click', smoothX, smoothY, upTarget, 0);
          }
          dragTarget = null;
        } else {
          // mão aberta, sem clique: só hover
          if (now - lastMoveDispatch > CONFIG.dragMoveThrottleMs) {
            fireMouseEvent('mousemove', smoothX, smoothY, null, 0);
            lastMoveDispatch = now;
          }
        }

        isFist = fistNow;
      } else {
        statusEl.textContent = 'mão: --';
      }
    }
  }

  // Pré-carrega o modelo assim que possível, sem pedir câmera ainda
  initModel().catch((err) => console.error('Falha ao pré-carregar modelo de mão:', err));
})();
