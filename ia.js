(async function() {
  const API_KEY = 'AQ.Ab8RN6JV7IK3AN_BnbaxMl5ieY8h_k7dpIpUXreVX3lC6Pg1Ug'; // Sua chave AIzaSy...



  // Função interna para converter Markdown básico em HTML
  function parseMarkdown(md) {
    if (!md) return '';
    let html = md
      // Escapa tags HTML nativas por segurança
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Títulos
      .replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px 0; font-size: 13px; font-weight: bold; color: #1a73e8;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 4px 0; font-size: 14px; font-weight: bold; color: #202124;">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 style="margin: 12px 0 6px 0; font-size: 15px; font-weight: bold; color: #202124;">$1</h2>')
      // Linha horizontal
      .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 8px 0;">')
      // Negrito e Itálico
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Itens de Lista com marcadores
      .replace(/^\s*[\-\*]\s+(.*)$/gim, '<li style="margin-left: 16px; list-style-type: disc;">$1</li>')
      // Listas numeradas
      .replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li style="margin-left: 16px; list-style-type: decimal;">$2</li>')
      // Quebras de linha normais
      .replace(/\n/gim, '<br style="margin-bottom: 4px;">');

    // Limpa <br> redundantes gerados logo após tags de bloco
    return html
      .replace(/(<\/h[234]>)\s*<br style="margin-bottom: 4px;">/gim, '$1')
      .replace(/(<hr[^>]*>)\s*<br style="margin-bottom: 4px;">/gim, '$1')
      .replace(/(<\/li>)\s*<br style="margin-bottom: 4px;">/gim, '$1');
  }

  const box = document.createElement('div');
  box.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; width: 350px;
    background: #ffffff; border: 1px solid #dadce0; border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 14px; display: flex; flex-direction: column; gap: 10px;
  `;
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong style="font-size:13px; color:#1f1f1f;">AI Assistant</strong>
      <span id="ai-close" style="cursor:pointer; color:#70757a; font-size:16px;">✕</span>
    </div>
    <div id="ai-selected-preview" style="display:none; font-size:11px; color:#1a73e8; background:#e8f0fe; padding:6px 8px; border-radius:6px; max-height:45px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
    <div id="ai-output" style="max-height:240px; overflow-y:auto; font-size:12px; line-height:1.55; color:#3c4043; background:#f8f9fa; padding:10px; border-radius:8px; border:1px solid #e8eaed; min-height:48px;">
      Selecione um texto, copie (Ctrl+C) ou digite uma pergunta...
    </div>
    <div style="display:flex; gap:6px;">
      <input id="ai-input" type="text" placeholder="Instrução..." style="flex:1; padding:8px 10px; border:1px solid #dadce0; border-radius:6px; font-size:12px; outline:none;">
      <button id="ai-send" style="background:#1a73e8; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;">Enviar</button>
    </div>
  `;
  document.body.appendChild(box);

  const output = box.querySelector('#ai-output');
  const input = box.querySelector('#ai-input');
  const sendBtn = box.querySelector('#ai-send');
  const preview = box.querySelector('#ai-selected-preview');
  box.querySelector('#ai-close').onclick = () => box.remove();

  let lastCapturedText = '';

  function updatePreview(text) {
    if (!text) return;
    lastCapturedText = text;
    preview.style.display = 'block';
    preview.innerText = '📎 Texto capturado: "' + text.slice(0, 45).replace(/\n/g, ' ') + (text.length > 45 ? '...' : '') + '"';
  }

  function getDeepSelection() {
    let sel = window.getSelection()?.toString().trim();
    if (sel) return sel;
    const frames = document.querySelectorAll('iframe');
    for (const f of frames) {
      try {
        const frameSel = f.contentWindow?.getSelection()?.toString().trim();
        if (frameSel) return frameSel;
      } catch (e) {}
    }
    return '';
  }

  const handleSelection = (e) => {
    if (e && box.contains(e.target)) return;
    const text = getDeepSelection();
    if (text) updatePreview(text);
  };

  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('selectionchange', handleSelection);

  document.addEventListener('copy', () => {
    setTimeout(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) updatePreview(text.trim());
      } catch (err) {}
    }, 50);
  });

  async function callAI(promptText) {
    output.innerHTML = '<em>Pensando...</em>';
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Status ${res.status}`);

      const rawMarkdown = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
      
      // Renderiza como HTML formatado
      output.innerHTML = parseMarkdown(rawMarkdown);
      output.scrollTop = 0; // Volta a barra de rolagem para o topo
      lastCapturedText = '';
      preview.style.display = 'none';
    } catch (err) {
      output.innerHTML = '<span style="color:#d93025;">Erro: ' + err.message + '</span>';
      console.error(err);
    }
  }

  sendBtn.onclick = () => {
    const userPrompt = input.value.trim();
    let finalQuery = '';

    if (lastCapturedText) {
      finalQuery = `Contexto selecionado na página:\n"${lastCapturedText}"\n\nInstrução:\n${userPrompt || 'Explique, resuma ou resolva com base no contexto acima.'}`;
    } else if (userPrompt) {
      finalQuery = userPrompt;
    }

    if (finalQuery) {
      callAI(finalQuery);
      input.value = '';
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });
})();
