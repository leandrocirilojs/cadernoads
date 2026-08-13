const DEFAULT_SUBJECTS = [
  { id: "1", name: "Análise e Modelagem de Sistemas", color: "#d98b3f" },
  { id: "2", name: "Engenharia de Software", color: "#5b8bd9" },
  { id: "3", name: "Redes de Computadores", color: "#6fbf73" }
];

// Temas de cor disponíveis para post-its
const POSTIT_COLORS = [
  { id: "yellow", hex: "#fffaaa" },
  { id: "pink", hex: "#ffcbe4" },
  { id: "blue", hex: "#cce5ff" },
  { id: "green", hex: "#d4edda" },
  { id: "purple", hex: "#e5d4f7" },
  { id: "orange", hex: "#ffe0b3" },
  { id: "mint", hex: "#c8f4e6" },
  { id: "gray", hex: "#e2e5ea" }
];

let SUBJECTS = JSON.parse(localStorage.getItem("agenda_subjects")) || DEFAULT_SUBJECTS;
let ELEMENTS = JSON.parse(localStorage.getItem("agenda_elements")) || {};

const subjectListEl = document.getElementById("subjectList");
const currentSubjectName = document.getElementById("currentSubjectName");
const currentSubjectMeta = document.getElementById("currentSubjectMeta");
const noteSheet = document.getElementById("noteSheet");
const todayLabel = document.getElementById("todayLabel");

let activeSubjectIndex = 0;
let activeView = "notes";
let currentDate = new Date();
let selectedDateFilter = null;

function saveToLocalStorage() {
  localStorage.setItem("agenda_subjects", JSON.stringify(SUBJECTS));
  localStorage.setItem("agenda_elements", JSON.stringify(ELEMENTS));
}

function getFormattedToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

/* ---------- REDIMENSIONAMENTO DINÂMICO DA FOLHA ---------- */
function adjustSheetSize() {
  const items = noteSheet.querySelectorAll(".draggable-item");
  let maxRight = 800;  // Largura mínima padrão
  let maxBottom = 1000; // Altura mínima padrão

  items.forEach((item) => {
    const right = item.offsetLeft + item.offsetWidth + 60;   // Margem de folga
    const bottom = item.offsetTop + item.offsetHeight + 60;

    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  });

  noteSheet.style.minWidth = `${maxRight}px`;
  noteSheet.style.minHeight = `${maxBottom}px`;
}

/* ---------- CALENDÁRIO ---------- */
function renderCalendar() {
  const calendarGrid = document.getElementById("calendarGrid");
  const calendarMonthLabel = document.getElementById("calendarMonthLabel");

  calendarGrid.innerHTML = "";
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

  const daysHead = ["D", "S", "T", "Q", "Q", "S", "S"];
  daysHead.forEach(d => {
    const el = document.createElement("div");
    el.className = "calendar-day-head";
    el.textContent = d;
    calendarGrid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";
    const dateString = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      dayEl.classList.add("today");
    }

    if (selectedDateFilter === dateString) {
      dayEl.classList.add("selected");
    }

    dayEl.textContent = day;

    dayEl.addEventListener("click", () => {
      selectedDateFilter = (selectedDateFilter === dateString) ? null : dateString;
      renderCalendar();
      renderContent();
    });

    calendarGrid.appendChild(dayEl);
  }
}

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonthBtn").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

/* ---------- MATÉRIAS (EDIÇÃO E EXCLUSÃO) ---------- */
function renderSubjects() {
  subjectListEl.innerHTML = "";
  SUBJECTS.forEach((subject, index) => {
    const li = document.createElement("li");
    li.className = "subject-item" + (index === activeSubjectIndex ? " active" : "");
    
    li.innerHTML = `
      <div class="subject-item-left">
        <span class="subject-dot" style="background:${subject.color}"></span>
        <span>${escapeHtml(subject.name)}</span>
      </div>
      <div class="subject-actions">
        <button class="btn-subject-action edit" title="Editar matéria">✏️</button>
        <button class="btn-subject-action del" title="Excluir matéria">🗑️</button>
      </div>
    `;

    li.querySelector(".subject-item-left").addEventListener("click", () => selectSubject(index));

    li.querySelector(".btn-subject-action.edit").addEventListener("click", (e) => {
      e.stopPropagation();
      editSubject(index);
    });

    li.querySelector(".btn-subject-action.del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSubject(index);
    });

    subjectListEl.appendChild(li);
  });
}

function selectSubject(index) {
  if (!SUBJECTS[index]) return;
  activeSubjectIndex = index;
  currentSubjectName.textContent = SUBJECTS[index].name;
  renderSubjects();
  renderContent();
}

function editSubject(index) {
  const subject = SUBJECTS[index];
  const newName = prompt("Editar nome da matéria:", subject.name);
  if (newName !== null && newName.trim() !== "") {
    subject.name = newName.trim();
    saveToLocalStorage();
    if (activeSubjectIndex === index) {
      currentSubjectName.textContent = subject.name;
    }
    renderSubjects();
  }
}

function deleteSubject(index) {
  if (SUBJECTS.length <= 1) {
    alert("Você precisa manter pelo menos uma matéria!");
    return;
  }

  const subject = SUBJECTS[index];
  const confirmDel = confirm(`Tem certeza que deseja excluir a matéria "${subject.name}"? Todos os elementos dela serão apagados.`);

  if (confirmDel) {
    delete ELEMENTS[subject.id];
    SUBJECTS.splice(index, 1);

    if (activeSubjectIndex >= SUBJECTS.length) {
      activeSubjectIndex = SUBJECTS.length - 1;
    } else if (activeSubjectIndex === index) {
      activeSubjectIndex = 0;
    }

    saveToLocalStorage();
    selectSubject(activeSubjectIndex);
  }
}

/* ---------- GERENCIAMENTO DE ELEMENTOS ---------- */
function getSubjectElements() {
  if (!SUBJECTS[activeSubjectIndex]) return [];
  const subjectId = SUBJECTS[activeSubjectIndex].id;
  if (!ELEMENTS[subjectId]) ELEMENTS[subjectId] = [];
  return ELEMENTS[subjectId];
}

function addElement(type, extraData = {}) {
  const items = getSubjectElements();
  const now = new Date();
  
  const targetDate = selectedDateFilter || getFormattedToday();
  const offset = (items.length * 20) % 200;

  // Ajusta a posição Y inicial se o formulário estiver visível para não sobrepor
  const form = document.getElementById("noteForm");
  const isFormVisible = form && form.style.display !== "none";
  const initialY = isFormVisible ? 280 : 80;

  const newItem = {
    id: Date.now().toString(),
    type,
    x: 40 + offset,
    y: initialY + offset,
    date: targetDate,
    fullDate: now.toLocaleString("pt-BR"),
    ...extraData
  };

  items.push(newItem);
  saveToLocalStorage();
  renderContent();
}

function deleteElement(id) {
  const subjectId = SUBJECTS[activeSubjectIndex].id;
  ELEMENTS[subjectId] = ELEMENTS[subjectId].filter(el => el.id !== id);
  saveToLocalStorage();
  renderContent();
}

/* ---------- DRAG AND DROP ---------- */
/* ---------- DRAG AND DROP (MOUSE E TOUCH) ---------- */
function makeDraggable(element, id) {
  const handle = element.querySelector(".drag-handle");
  if (!handle) return;

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  // Função para iniciar o movimento (Mouse ou Touch)
  function startDrag(clientX, clientY) {
    isDragging = true;
    startX = clientX;
    startY = clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
  }

  // Função para mover o elemento (Mouse ou Touch)
  function moveDrag(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;

    const newX = Math.max(0, initialLeft + dx);
    const newY = Math.max(0, initialTop + dy);

    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;
  }

  // Função para finalizar o movimento
  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;

    // Remove ouvintes Globais de Mouse
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    // Remove ouvintes Globais de Touch
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);

    // Salva a nova posição
    const items = getSubjectElements();
    const item = items.find(el => el.id === id);
    if (item) {
      item.x = element.offsetLeft;
      item.y = element.offsetTop;
      saveToLocalStorage();
      adjustSheetSize();
    }
  }

  /* --- EVENTOS DE MOUSE --- */
  function onMouseMove(e) {
    moveDrag(e.clientX, e.clientY);
  }

  function onMouseUp() {
    stopDrag();
  }

  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    startDrag(e.clientX, e.clientY);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  /* --- EVENTOS DE TOUCH (TABLETS / CELULARES) --- */
  function onTouchMove(e) {
    if (e.touches.length > 0) {
      // Impede a tela do celular de rolar enquanto arrasta o item
      e.preventDefault(); 
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onTouchEnd() {
    stopDrag();
  }

  handle.addEventListener("touchstart", (e) => {
    if (e.target.tagName === "BUTTON") return;
    if (e.touches.length > 0) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
      // O parâmetro { passive: false } permite usar e.preventDefault()
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
    }
  });
}

/* ---------- RENDERIZAÇÃO ---------- */
function renderContent() {
  noteSheet.innerHTML = "";
  
  if (!SUBJECTS[activeSubjectIndex]) {
    currentSubjectName.textContent = "Selecione uma matéria";
    currentSubjectMeta.textContent = "0 itens";
    return;
  }

  if (activeView === "schedule") {
    noteSheet.innerHTML = `
      <div class="empty-state">
        <div class="icon">＋</div>
        <h3>Área em desenvolvimento</h3>
        <p>Alterne para a aba "Anotações" ou "Tarefas" para interagir com o quadro.</p>
      </div>`;
    return;
  }

  const items = getSubjectElements();
  const viewItems = items.filter(el => (activeView === "tasks" ? el.type === "task" : el.type !== "task"));
  let filteredItems = viewItems;

  if (selectedDateFilter) {
    filteredItems = viewItems.filter(el => el.date === selectedDateFilter);
  }

  const filterStatus = selectedDateFilter ? ` (Data: ${selectedDateFilter})` : "";
  const itemLabel = activeView === "tasks" ? "tarefa(s)" : "elemento(s)";
  currentSubjectMeta.textContent = `${filteredItems.length} ${itemLabel}${filterStatus}`;

  const toolbar = document.createElement("div");
  toolbar.className = "notes-toolbar";

  if (activeView === "tasks") {
    toolbar.innerHTML = `<button class="btn-primary" id="quickAddTaskBtn">+ Nova Tarefa</button>`;
    noteSheet.appendChild(toolbar);
    toolbar.querySelector("#quickAddTaskBtn").addEventListener("click", () => {
      addElement("task", { text: "", done: false });
    });
  } else {
    toolbar.innerHTML = `
      <button class="btn-primary" id="toggleFormBtn">+ Nova Anotação</button>
      <form class="note-form" id="noteForm" style="display: none; margin-top: 12px;">
        <input type="text" id="noteTitle" placeholder="Título da anotação..." required />
        <div class="format-toolbar-slot" id="noteFormToolbarSlot"></div>
        <div id="noteContent" class="note-form-content" contenteditable="true" data-placeholder="Escreva o conteúdo aqui... (pode colar texto formatado)"></div>
        <button type="submit" class="btn-primary">Salvar no Quadro</button>
      </form>
    `;
    noteSheet.appendChild(toolbar);

    const toggleBtn = toolbar.querySelector("#toggleFormBtn");
    const form = toolbar.querySelector("#noteForm");
    const contentInput = form.querySelector("#noteContent");
    form.querySelector("#noteFormToolbarSlot").appendChild(buildFormatToolbar(contentInput));
    attachRichPasteHandler(contentInput);

    toggleBtn.addEventListener("click", () => {
      form.style.display = form.style.display === "none" ? "flex" : "none";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const titleInput = document.getElementById("noteTitle");
      const title = titleInput.value.trim();
      const content = sanitizePastedHtml(contentInput.innerHTML).trim();

      if (title && content) {
        addElement("note", { title, content });
        titleInput.value = "";
        contentInput.innerHTML = "";
        form.style.display = "none";
      }
    });
  }

  if (filteredItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = activeView === "tasks" ? `
      <div class="icon">☑️</div>
      <h3>Nenhuma tarefa nesta data</h3>
      <p>Use o botão "+ Nova Tarefa" acima ou o menu lateral para adicionar uma.</p>
    ` : `
      <div class="icon">📝</div>
      <h3>Nenhum elemento nesta data</h3>
      <p>Use os botões no menu lateral para adicionar Post-its, Tabelas ou Anotações.</p>
    `;
    noteSheet.appendChild(empty);
    adjustSheetSize();
    return;
  }

  filteredItems.forEach(item => {
    const container = document.createElement("div");
    container.className = "draggable-item";
    container.style.left = `${item.x}px`;
    container.style.top = `${item.y}px`;

    let bodyContent = "";

    if (item.type === "postit") {
      container.classList.add("postit-item", `postit-${item.color || 'yellow'}`);
      bodyContent = `
        <div class="drag-handle">
          ⋮⋮ Post-it
          <div class="postit-header-actions">
            <button class="btn-postit-color" type="button" title="Mudar cor">🎨</button>
            <button class="btn-item-del" data-id="${item.id}">✕</button>
          </div>
        </div>
        <div class="postit-color-picker" style="display:none;"></div>
        <div class="format-toolbar-slot"></div>
        <div class="postit-text" contenteditable="true" data-placeholder="Lembrete...">${item.text || ''}</div>
      `;
    } else if (item.type === "note") {
      container.classList.add("note-card-item");
      bodyContent = `
        <div class="drag-handle">⋮⋮ Anotação <button class="btn-item-del" data-id="${item.id}">✕</button></div>
        <h4>${escapeHtml(item.title)}</h4>
        <div class="format-toolbar-slot"></div>
        <div class="note-content" contenteditable="true" data-placeholder="Escreva aqui...">${item.content || ''}</div>
        <span class="note-date">${item.fullDate || item.date}</span>
      `;
    } else if (item.type === "table") {
      container.classList.add("table-item");
      let tableRows = "";
      const data = item.data || Array(item.rows).fill("").map(() => Array(item.cols).fill(""));

      for (let r = 0; r < item.rows; r++) {
        tableRows += "<tr>";
        for (let c = 0; c < item.cols; c++) {
          const cellValue = (data[r] && data[r][c]) ? data[r][c] : "";
          tableRows += `<td contenteditable="true" data-row="${r}" data-col="${c}">${cellValue}</td>`;
        }
        tableRows += "</tr>";
      }

      bodyContent = `
        <div class="drag-handle">⋮⋮ Tabela (${item.rows}x${item.cols}) <button class="btn-item-del" data-id="${item.id}">✕</button></div>
        <table class="custom-table">${tableRows}</table>
      `;
    } else if (item.type === "task") {
      container.classList.add("task-item");
      bodyContent = `
        <div class="drag-handle">⋮⋮ Tarefa <button class="btn-item-del" data-id="${item.id}">✕</button></div>
        <div class="task-body">
          <input type="checkbox" class="task-check" ${item.done ? "checked" : ""} />
          <div class="task-text ${item.done ? 'task-done' : ''}" contenteditable="true" data-placeholder="Descreva a tarefa...">${item.text || ''}</div>
        </div>
      `;
    }

    container.innerHTML = bodyContent;
    noteSheet.appendChild(container);

    const delBtn = container.querySelector(".btn-item-del");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteElement(item.id);
      });
    }

    if (item.type === "postit") {
      const textEl = container.querySelector(".postit-text");
      const toolbarSlot = container.querySelector(".format-toolbar-slot");
      toolbarSlot.appendChild(buildFormatToolbar(textEl));

      attachRichPasteHandler(textEl);
      textEl.addEventListener("input", () => {
        item.text = sanitizePastedHtml(textEl.innerHTML);
        saveToLocalStorage();
      });

      const colorBtn = container.querySelector(".btn-postit-color");
      const colorPicker = container.querySelector(".postit-color-picker");
      POSTIT_COLORS.forEach(({ id, hex }) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "postit-color-swatch" + (item.color === id ? " selected" : "");
        swatch.style.background = hex;
        swatch.title = id;
        swatch.addEventListener("click", () => {
          container.classList.remove(`postit-${item.color || 'yellow'}`);
          item.color = id;
          container.classList.add(`postit-${id}`);
          colorPicker.querySelectorAll(".postit-color-swatch").forEach(s => s.classList.remove("selected"));
          swatch.classList.add("selected");
          saveToLocalStorage();
        });
        colorPicker.appendChild(swatch);
      });
      colorBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        colorPicker.style.display = colorPicker.style.display === "none" ? "flex" : "none";
      });
    }

    if (item.type === "note") {
      const contentEl = container.querySelector(".note-content");
      const toolbarSlot = container.querySelector(".format-toolbar-slot");
      toolbarSlot.appendChild(buildFormatToolbar(contentEl));

      attachRichPasteHandler(contentEl);
      contentEl.addEventListener("input", () => {
        item.content = sanitizePastedHtml(contentEl.innerHTML);
        saveToLocalStorage();
      });
    }

    if (item.type === "task") {
      const textEl = container.querySelector(".task-text");
      const checkEl = container.querySelector(".task-check");

      attachRichPasteHandler(textEl);
      textEl.addEventListener("input", () => {
        item.text = sanitizePastedHtml(textEl.innerHTML);
        saveToLocalStorage();
      });

      checkEl.addEventListener("change", () => {
        item.done = checkEl.checked;
        textEl.classList.toggle("task-done", item.done);
        saveToLocalStorage();
      });
    }

    if (item.type === "table") {
      const cells = container.querySelectorAll("td[contenteditable]");
      cells.forEach(cell => {
        attachRichPasteHandler(cell);
        cell.addEventListener("blur", () => {
          const r = cell.dataset.row;
          const c = cell.dataset.col;
          if (!item.data) item.data = Array(item.rows).fill("").map(() => Array(item.cols).fill(""));
          item.data[r][c] = sanitizePastedHtml(cell.innerHTML);
          saveToLocalStorage();
        });
      });
    }

    makeDraggable(container, item.id);
  });

  // Recalcula as dimensões da folha após adicionar todos os elementos
  adjustSheetSize();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ---------- COLAR COM FORMATAÇÃO (RICH PASTE) ---------- */
const RICH_ALLOWED_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "FONT",
  "BR", "P", "DIV", "MARK", "SUB", "SUP", "UL", "OL", "LI"
]);

const RICH_ALLOWED_STYLES = new Set([
  "color", "background-color", "font-weight", "font-style",
  "text-decoration", "font-size", "font-family"
]);

// Limpa HTML colado: mantém negrito/itálico/cor/tamanho/fonte,
// remove scripts, links de imagem, atributos perigosos (onClick etc.)
function sanitizePastedHtml(dirtyHtml) {
  const container = document.createElement("div");
  container.innerHTML = dirtyHtml;

  function cleanNode(node) {
    // Remove nós perigosos por completo
    if (node.nodeType === 1) {
      const tag = node.tagName;
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "IMG", "svg"].includes(tag)) {
        node.remove();
        return;
      }
    }

    // Processa filhos primeiro (cópia estática da lista, pois pode mudar)
    Array.from(node.childNodes || []).forEach(cleanNode);

    if (node.nodeType !== 1) return; // texto, comentário etc. — nada a fazer

    const tag = node.tagName;

    if (!RICH_ALLOWED_TAGS.has(tag)) {
      // "Desembrulha": mantém o conteúdo/filhos, remove só a tag não permitida
      while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
      node.remove();
      return;
    }

    // Converte FONT color="" para style equivalente
    if (tag === "FONT") {
      const color = node.getAttribute("color");
      if (color) node.style.color = color;
    }

    // Filtra atributos: mantém só um "style" com propriedades permitidas
    const keepStyle = {};
    if (node.style && node.style.length) {
      Array.from(node.style).forEach((prop) => {
        if (RICH_ALLOWED_STYLES.has(prop)) {
          keepStyle[prop] = node.style.getPropertyValue(prop);
        }
      });
    }

    Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));

    Object.entries(keepStyle).forEach(([prop, val]) => {
      node.style.setProperty(prop, val);
    });
  }

  Array.from(container.childNodes).forEach(cleanNode);
  return container.innerHTML;
}

// Insere HTML na posição do cursor dentro de um elemento contentEditable
function insertHtmlAtCursor(html) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const fragment = range.createContextualFragment(html);
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);

  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Liga um elemento contentEditable para aceitar colagem com formatação preservada
function attachRichPasteHandler(el) {
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const clipboard = e.clipboardData || window.clipboardData;
    const html = clipboard.getData("text/html");
    const plain = clipboard.getData("text/plain");

    let insertHtml;
    if (html) {
      insertHtml = sanitizePastedHtml(html);
    } else {
      insertHtml = escapeHtml(plain).replace(/\n/g, "<br>");
    }

    insertHtmlAtCursor(insertHtml);
  });
}

/* ---------- MINI BARRA DE FORMATAÇÃO (negrito, itálico, cor) ---------- */
function applyFormat(editableEl, command, value = null) {
  editableEl.focus();
  document.execCommand(command, false, value);
  editableEl.dispatchEvent(new Event("input", { bubbles: true }));
}

// Aplica tamanho de fonte via <span style="font-size:...">, em vez do
// comando legado "fontSize" do navegador (que usa <font size="1-7">,
// não sobrevive ao sanitizador, e cujo valor "3/Normal" é idêntico ao
// tamanho padrão — por isso parecia não ter efeito nenhum).
function applyFontSize(editableEl, sizePx) {
  editableEl.focus();
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  let range = selection.getRangeAt(0);
  if (!editableEl.contains(range.commonAncestorContainer)) return;

  // Sem seleção de texto: aplica ao conteúdo inteiro do campo
  if (selection.isCollapsed) {
    range = document.createRange();
    range.selectNodeContents(editableEl);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const span = document.createElement("span");
  span.style.fontSize = sizePx;

  try {
    range.surroundContents(span);
  } catch (e) {
    // Seleção cruza várias tags (ex: negrito + normal) — extrai e reembrulha
    const content = range.extractContents();
    span.appendChild(content);
    range.insertNode(span);
  }

  selection.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  selection.addRange(newRange);

  editableEl.dispatchEvent(new Event("input", { bubbles: true }));
}

const FORMAT_TEXT_COLORS = ["#23282f", "#d9534f", "#d98b3f", "#2e8b57", "#3468c0", "#8e44ad"];

// Cria uma mini barra (negrito, itálico, riscado, cores) presa a um campo contentEditable
function buildFormatToolbar(editableEl) {
  const toolbar = document.createElement("div");
  toolbar.className = "format-toolbar";

  const styleButtons = [
    { label: "B", title: "Negrito", command: "bold", cls: "fmt-bold" },
    { label: "I", title: "Itálico", command: "italic", cls: "fmt-italic" },
    { label: "S", title: "Riscado", command: "strikeThrough", cls: "fmt-strike" }
  ];

  styleButtons.forEach(({ label, title, command, cls }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `fmt-btn ${cls}`;
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // não perder a seleção
    btn.addEventListener("click", () => applyFormat(editableEl, command));
    toolbar.appendChild(btn);
  });

  const sizeSelect = document.createElement("select");
  sizeSelect.className = "fmt-size-select";
  sizeSelect.title = "Tamanho do texto";
  [["12px", "Pequeno"], ["14px", "Normal"], ["20px", "Grande"], ["28px", "Enorme"]].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    sizeSelect.appendChild(opt);
  });
  sizeSelect.value = "14px";

  // Selects precisam de foco pra abrir a lista nativa, o que faz o
  // navegador perder a seleção de texto do campo antes do "change"
  // disparar. Salvamos a seleção no mousedown e restauramos depois.
  let savedSizeRange = null;
  sizeSelect.addEventListener("mousedown", () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editableEl.contains(sel.anchorNode)) {
      savedSizeRange = sel.getRangeAt(0).cloneRange();
    }
  });
  sizeSelect.addEventListener("change", () => {
    editableEl.focus();
    if (savedSizeRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSizeRange);
    }
    applyFontSize(editableEl, sizeSelect.value);
  });

  toolbar.appendChild(sizeSelect);

  const colorGroup = document.createElement("div");
  colorGroup.className = "fmt-color-group";

  FORMAT_TEXT_COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "fmt-swatch";
    swatch.style.background = color;
    swatch.title = "Cor do texto";
    swatch.addEventListener("mousedown", (e) => e.preventDefault());
    swatch.addEventListener("click", () => applyFormat(editableEl, "foreColor", color));
    colorGroup.appendChild(swatch);
  });

  // Cor personalizada: o seletor nativo de cor rouba o foco, então salvamos
  // a seleção de texto antes de abrir e restauramos ao aplicar.
  let savedRange = null;
  const customColor = document.createElement("input");
  customColor.type = "color";
  customColor.className = "fmt-custom-color";
  customColor.title = "Cor personalizada";
  customColor.addEventListener("mousedown", () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editableEl.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  });
  customColor.addEventListener("input", (e) => {
    editableEl.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    applyFormat(editableEl, "foreColor", e.target.value);
  });
  colorGroup.appendChild(customColor);

  toolbar.appendChild(colorGroup);

  return toolbar;
}

/* ATALHOS INSERIR */
document.getElementById("addPostitBtn").addEventListener("click", () => {
  activeView = "notes";
  document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('[data-view="notes"]').classList.add("active");
  const randomColor = POSTIT_COLORS[Math.floor(Math.random() * POSTIT_COLORS.length)].id;
  addElement("postit", { text: "", color: randomColor });
});

document.getElementById("addTableBtn").addEventListener("click", () => {
  activeView = "notes";
  document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('[data-view="notes"]').classList.add("active");
  const rows = parseInt(prompt("Número de linhas:", "3")) || 3;
  const cols = parseInt(prompt("Número de colunas:", "3")) || 3;
  addElement("table", { rows, cols });
});

document.getElementById("addQuickNoteBtn").addEventListener("click", () => {
  activeView = "notes";
  document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('[data-view="notes"]').classList.add("active");
  renderContent();
  const form = document.getElementById("noteForm");
  if (form) form.style.display = "flex";
});

document.getElementById("addQuickTaskBtn").addEventListener("click", () => {
  activeView = "tasks";
  document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('[data-view="tasks"]').classList.add("active");
  addElement("task", { text: "", done: false });
});

document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".view-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeView = tab.dataset.view;
    renderContent();
  });
});

document.getElementById("addSubjectBtn").addEventListener("click", () => {
  const name = prompt("Nome da nova matéria:");
  if (name && name.trim()) {
    const newSubject = {
      id: Date.now().toString(),
      name: name.trim(),
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
    };
    SUBJECTS.push(newSubject);
    saveToLocalStorage();
    selectSubject(SUBJECTS.length - 1);
  }
});

todayLabel.textContent = new Date().toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

renderCalendar();
renderSubjects();
selectSubject(0);
