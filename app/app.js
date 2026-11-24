const $ = (selector) => document.querySelector(selector);
const THEME_KEY = "kb-theme";
const GRID_KEY = "kb-grid-visible";
const URL_KEY = "kb-sheet-url";

let sheet = { rows: [], rowCount: 0, columnCount: 0 };
let sidebarCompact = false;

function setTheme(theme) {
  const selected = ["system", "light", "dark"].includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = selected;
  const select = $("#theme-select");
  if (select) select.value = selected;
  localStorage.setItem(THEME_KEY, selected);
}

function applyTheme() {
  setTheme(localStorage.getItem(THEME_KEY) || "system");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function buildPreviewDocument(rows, columnCount) {
  const bodyRows = rows.map((row) => {
    const cells = Array.from({ length: columnCount }, (_, index) =>
      '<td>' + escapeHtml(row[index] ?? "") + '</td>'
    ).join("");
    return "<tr>" + cells + "</tr>";
  }).join("");
  return '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#fff;color:#20242b}' +
    'body{padding:24px;font:14px/1.5 Inter,"Segoe UI",Arial,sans-serif}' +
    'table{border-collapse:collapse;table-layout:fixed;min-width:100%;width:max-content;max-width:none}' +
    'td{min-width:96px;width:96px;height:32px;padding:5px 8px;border:1px solid #e1e5eb;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}' +
    '</style></head><body><table><tbody>' + bodyRows + '</tbody></table></body></html>';
}

function columnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function renderGrid() {
  const overlay = $("#grid-overlay");
  const visible = localStorage.getItem(GRID_KEY) === "true";
  if (!visible || !sheet.rowCount || !sheet.columnCount) {
    overlay.hidden = true;
    overlay.replaceChildren();
    return;
  }

  overlay.hidden = false;
  overlay.style.setProperty("--grid-columns", String(sheet.columnCount));
  overlay.style.setProperty("--grid-rows", String(sheet.rowCount));
  overlay.style.backgroundSize =
    (100 / sheet.columnCount) + "% 100%, 100% " + (100 / sheet.rowCount) + "%";

  const total = sheet.rowCount * sheet.columnCount;
  const labelLimit = 10000;
  const fragment = document.createDocumentFragment();
  const count = Math.min(total, labelLimit);
  for (let i = 0; i < count; i++) {
    const cell = document.createElement("span");
    cell.className = "grid-coordinate";
    cell.textContent = columnName(i % sheet.columnCount) + (Math.floor(i / sheet.columnCount) + 1);
    fragment.append(cell);
  }
  overlay.replaceChildren(fragment);
  overlay.style.gridTemplateColumns = "repeat(" + sheet.columnCount + ", minmax(0, 1fr))";
  overlay.style.gridTemplateRows = "repeat(" + sheet.rowCount + ", minmax(0, 1fr))";
}

function renderSheetData(data) {
  sheet = {
    rows: Array.isArray(data.rows) ? data.rows : [],
    rowCount: Number(data.rowCount) || 0,
    columnCount: Number(data.columnCount) || 0
  };
  $("#preview-frame").srcdoc = buildPreviewDocument(sheet.rows, sheet.columnCount);
  renderGrid();
}

async function renderSheet(url) {
  const message = $("#source-message");
  message.textContent = "Mengambil data spreadsheet…";
  message.className = "message";
  try {
    const data = await api("/api/render-sheet", {
      method: "POST",
      body: JSON.stringify({ url })
    });
    renderSheetData(data);
    localStorage.setItem(URL_KEY, url);
    message.textContent = "Spreadsheet berhasil diterjemahkan: " +
      data.rowCount + " baris × " + data.columnCount + " kolom.";
    message.classList.add("success");
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
}

function selectPanel(name) {
  const title = $("#panel-title");
  const content = $("#panel-content");
  $("#sidebar-nav").querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.panel === name;
    button.classList.toggle("is-selected", active);
    button.querySelector(".nav-arrow").textContent = active ? "⌄" : "›";
  });

  const panels = {
    umum: {
      title: "Umum",
      html: '<label class="field"><span>Tema antarmuka</span><select id="theme-select"><option value="system">System</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label>' +
        '<p class="note">Preview mengikuti ruang yang tersedia. Tutup sidebar untuk memaksimalkan area preview.</p>'
    },
    sumber: {
      title: "Sumber Editor",
      html: '<form id="sheet-form" class="source-form"><label class="field"><span>URL CSV Google Sheets</span><input id="sheet-url" type="url" placeholder="Tempel URL Publish to web (CSV)" required></label>' +
        '<button class="action-button" type="submit">Render</button><p class="help">Google Sheets: File → Bagikan → Publikasikan ke web → pilih sheet → CSV → Publikasikan.</p><p id="source-message" class="message" role="status"></p></form>'
    },
    grid: {
      title: "Grid",
      html: '<label class="check-field"><input id="grid-visible" type="checkbox"><span>Tampilkan Grid</span></label>' +
        '<p class="note">Grid mengikuti jumlah baris dan kolom dari data editor. Label menggunakan koordinat A1, B1, C1, dan seterusnya.</p>' +
        '<p id="grid-info" class="muted">Belum ada data editor.</p>'
    },
    proyek: {
      title: "Proyek",
      html: '<p id="workspace-path" class="muted">Memuat lokasi penyimpanan…</p>' +
        '<form id="create-form" class="source-form"><label class="field"><span>Buat proyek baru</span><input id="project-name" type="text" maxlength="80" placeholder="Nama proyek" required></label><button class="action-button" type="submit">Buat proyek</button><p id="project-message" class="message" role="status"></p></form>' +
        '<div class="project-tools"><button id="refresh-projects" class="subtle-button" type="button">Muat ulang</button></div><div id="projects" class="projects">Memuat daftar proyek…</div>'
    }
  };

  const selected = panels[name] || panels.umum;
  title.textContent = selected.title;
  content.innerHTML = selected.html;

  if (name === "umum") {
    $("#theme-select").value = document.documentElement.dataset.theme || "system";
    $("#theme-select").addEventListener("change", (event) => setTheme(event.target.value));
  }
  if (name === "sumber") {
    $("#sheet-url").value = localStorage.getItem(URL_KEY) || "";
    $("#sheet-form").addEventListener("submit", (event) => {
      event.preventDefault();
      renderSheet($("#sheet-url").value.trim());
    });
  }
  if (name === "grid") {
    const checkbox = $("#grid-visible");
    checkbox.checked = localStorage.getItem(GRID_KEY) === "true";
    checkbox.addEventListener("change", () => {
      localStorage.setItem(GRID_KEY, String(checkbox.checked));
      renderGrid();
    });
    $("#grid-info").textContent = sheet.rowCount
      ? sheet.rowCount + " baris × " + sheet.columnCount + " kolom"
      : "Belum ada data editor.";
  }
  if (name === "proyek") initializeProjects();
}

function updateGeometry() {
  const root = document.documentElement;
  const width = Math.max(1, root.clientWidth || window.innerWidth);
  const height = Math.max(1, root.clientHeight || window.innerHeight);
  const baseWidth = width * 0.25;
  const scale = sidebarCompact ? 0.5 : 1;
  const open = document.body.classList.contains("sidebar-open");
  const sidebarWidth = open ? baseWidth * scale : 0;
  const previewWidth = width - sidebarWidth;
  const previewScale = previewWidth / width;

  document.body.style.setProperty("--sidebar-width", sidebarWidth + "px");
  document.body.style.setProperty("--sidebar-base-width", baseWidth + "px");
  document.body.style.setProperty("--sidebar-scale", String(scale));
  document.body.style.setProperty("--sidebar-button-edge", (baseWidth * scale) + "px");
  document.body.style.setProperty("--preview-left", sidebarWidth + "px");
  document.body.style.setProperty("--preview-width", previewWidth + "px");

  const stage = $("#preview-stage");
  stage.style.width = width + "px";
  stage.style.height = height + "px";
  stage.style.transform = "translate3d(" + sidebarWidth + "px,0,0) scale(" + previewScale + ")";
  $("#preview-frame").style.height = (height / previewScale) + "px";

  const grid = $("#grid-overlay");
  grid.style.left = sidebarWidth + "px";
  grid.style.width = previewWidth + "px";
  grid.style.height = height + "px";
  if (!grid.hidden) renderGrid();
}

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", Boolean(open));
  $("#editor-sidebar").classList.toggle("is-open", Boolean(open));
  $("#sidebar-toggle").setAttribute("aria-expanded", String(Boolean(open)));
  $("#sidebar-toggle").setAttribute("aria-label", open ? "Tutup sidebar pengaturan" : "Buka sidebar pengaturan");
  updateGeometry();
}

function setCompact(compact) {
  sidebarCompact = Boolean(compact);
  document.body.classList.toggle("sidebar-compact", sidebarCompact);
  updateGeometry();
}

async function initializeProjects() {
  try {
    const status = await api("/api/status");
    $("#workspace-path").textContent = status.workspace;
    await loadProjects();
  } catch (error) {
    $("#projects").textContent = error.message;
  }

  $("#create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#project-name");
    const message = $("#project-message");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: input.value.trim() })
      });
      input.value = "";
      message.textContent = "Proyek berhasil dibuat.";
      message.className = "message success";
      await loadProjects();
    } catch (error) {
      message.textContent = error.message;
      message.className = "message error";
    }
  });
  $("#refresh-projects").addEventListener("click", loadProjects);
}

async function loadProjects() {
  const container = $("#projects");
  try {
    const data = await api("/api/projects");
    container.replaceChildren();
    if (!data.projects.length) {
      container.textContent = "Belum ada proyek.";
      return;
    }
    data.projects.forEach((project) => {
      const item = document.createElement("div");
      item.className = "project-item";
      const name = document.createElement("strong");
      name.textContent = project.name;
      const path = document.createElement("small");
      path.textContent = project.path;
      item.append(name, path);
      container.append(item);
    });
  } catch (error) {
    container.textContent = error.message;
  }
}

function initializeSidebar() {
  $("#sidebar-nav").addEventListener("click", (event) => {
    const button = event.target.closest(".nav-item");
    if (button) selectPanel(button.dataset.panel);
  });
  $("#sidebar-toggle").addEventListener("click", () => {
    setSidebarOpen(!document.body.classList.contains("sidebar-open"));
  });
  $("#sidebar-handle").addEventListener("pointerdown", (event) => {
    $("#sidebar-handle").setPointerCapture(event.pointerId);
    $("#sidebar-handle").dataset.startX = String(event.clientX);
  });
  $("#sidebar-handle").addEventListener("pointerup", (event) => {
    const start = Number($("#sidebar-handle").dataset.startX || event.clientX);
    const delta = event.clientX - start;
    if (Math.abs(delta) > 8) setCompact(delta < 0);
    else setCompact(!sidebarCompact);
  });
  $("#sidebar-handle").addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { setCompact(true); event.preventDefault(); }
    if (event.key === "ArrowRight") { setCompact(false); event.preventDefault(); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSidebarOpen(false);
  });
  window.addEventListener("resize", updateGeometry, { passive: true });
  selectPanel("umum");
  setSidebarOpen(false);
}

applyTheme();
initializeSidebar();
updateGeometry();

const savedUrl = localStorage.getItem(URL_KEY);
if (savedUrl) renderSheet(savedUrl);
