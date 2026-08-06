const DEFAULT_SUBJECTS = [
  { id: "1", name: "Análise e Modelagem de Sistemas", color: "#d98b3f" },
  { id: "2", name: "Engenharia de Software", color: "#5b8bd9" },
  { id: "3", name: "Redes de Computadores", color: "#6fbf73" }
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
function makeDraggable(element, id) {
  const handle = element.querySelector(".drag-handle");
  if (!handle) return;

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;

    function onMouseMove(moveEvent) {
      if (!isDragging) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const newX = Math.max(0, initialLeft + dx);
      const newY = Math.max(0, initialTop + dy);

      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      const items = getSubjectElements();
      const item = items.find(el => el.id === id);
      if (item) {
        item.x = element.offsetLeft;
        item.y = element.offsetTop;
        saveToLocalStorage();
        adjustSheetSize(); // Redimensiona a folha ao terminar de arrastar
      }
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
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

  if (activeView !== "notes") {
    noteSheet.innerHTML = `
      <div class="empty-state">
        <div class="icon">＋</div>
        <h3>Área em desenvolvimento</h3>
        <p>Alterne para a aba "Anotações" para interagir com o quadro livre.</p>
      </div>`;
    return;
  }

  const items = getSubjectElements();
  let filteredItems = items;

  if (selectedDateFilter) {
    filteredItems = items.filter(el => el.date === selectedDateFilter);
  }

  const filterStatus = selectedDateFilter ? ` (Data: ${selectedDateFilter})` : "";
  currentSubjectMeta.textContent = `${filteredItems.length} elemento(s)${filterStatus}`;

  const toolbar = document.createElement("div");
  toolbar.className = "notes-toolbar";
  toolbar.innerHTML = `
    <button class="btn-primary" id="toggleFormBtn">+ Nova Anotação</button>
    <form class="note-form" id="noteForm" style="display: none; margin-top: 12px;">
      <input type="text" id="noteTitle" placeholder="Título da anotação..." required />
      <textarea id="noteContent" placeholder="Escreva o conteúdo aqui..." required></textarea>
      <button type="submit" class="btn-primary">Salvar no Quadro</button>
    </form>
  `;
  noteSheet.appendChild(toolbar);

  const toggleBtn = toolbar.querySelector("#toggleFormBtn");
  const form = toolbar.querySelector("#noteForm");
  toggleBtn.addEventListener("click", () => {
    form.style.display = form.style.display === "none" ? "flex" : "none";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("noteTitle");
    const contentInput = document.getElementById("noteContent");
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (title && content) {
      addElement("note", { title, content });
      titleInput.value = "";
      contentInput.value = "";
      form.style.display = "none";
    }
  });

  if (filteredItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
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
        <div class="drag-handle">⋮⋮ Post-it <button class="btn-item-del" data-id="${item.id}">✕</button></div>
        <textarea placeholder="Lembrete...">${escapeHtml(item.text || '')}</textarea>
      `;
    } else if (item.type === "note") {
      container.classList.add("note-card-item");
      bodyContent = `
        <div class="drag-handle">⋮⋮ Anotação <button class="btn-item-del" data-id="${item.id}">✕</button></div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.content)}</p>
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
          tableRows += `<td contenteditable="true" data-row="${r}" data-col="${c}">${escapeHtml(cellValue)}</td>`;
        }
        tableRows += "</tr>";
      }

      bodyContent = `
        <div class="drag-handle">⋮⋮ Tabela (${item.rows}x${item.cols}) <button class="btn-item-del" data-id="${item.id}">✕</button></div>
        <table class="custom-table">${tableRows}</table>
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
      const textarea = container.querySelector("textarea");
      textarea.addEventListener("change", (e) => {
        item.text = e.target.value;
        saveToLocalStorage();
      });
    }

    if (item.type === "table") {
      const cells = container.querySelectorAll("td[contenteditable]");
      cells.forEach(cell => {
        cell.addEventListener("blur", () => {
          const r = cell.dataset.row;
          const c = cell.dataset.col;
          if (!item.data) item.data = Array(item.rows).fill("").map(() => Array(item.cols).fill(""));
          item.data[r][c] = cell.innerText;
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

/* ATALHOS INSERIR */
document.getElementById("addPostitBtn").addEventListener("click", () => {
  const colors = ["yellow", "pink", "blue", "green"];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  addElement("postit", { text: "", color: randomColor });
});

document.getElementById("addTableBtn").addEventListener("click", () => {
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
  const taskName = prompt("Descrição da tarefa:");
  if (taskName && taskName.trim()) {
    alert(`Tarefa "${taskName.trim()}" registrada!`);
  }
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
