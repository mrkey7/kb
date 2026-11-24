const $ = (selector) => document.querySelector(selector);

const THEME_KEY = "kb-theme";

function setTheme(theme) {
  const selected = ["system", "light", "dark"].includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = selected;
  $("#theme-select").value = selected;
  localStorage.setItem(THEME_KEY, selected);
}

function initializeTheme() {
  setTheme(localStorage.getItem(THEME_KEY) || "system");
  $("#theme-select").addEventListener("change", (event) => setTheme(event.target.value));
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

function showMessage(message, isError = true) {
  const element = $("#message");
  element.textContent = message;
  element.classList.toggle("success", !isError);
}

async function loadProjects() {
  const container = $("#projects");
  container.innerHTML = '<p class="muted">Memuat daftar proyek…</p>';
  try {
    const data = await api("/api/projects");
    container.replaceChildren();
    if (!data.projects.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Belum ada proyek. Silakan buat proyek pertama.";
      container.append(empty);
      return;
    }
    for (const project of data.projects) {
      const item = document.createElement("div");
      item.className = "project";
      const icon = document.createElement("div");
      icon.className = "project-icon";
      icon.textContent = "KB";
      const details = document.createElement("div");
      const name = document.createElement("div");
      name.className = "project-name";
      name.textContent = project.name;
      const path = document.createElement("div");
      path.className = "project-path";
      path.textContent = project.path;
      details.append(name, path);
      item.append(icon, details);
      container.append(item);
    }
  } catch (error) {
    container.textContent = error.message;
  }
}

async function initialize() {
  try {
    const status = await api("/api/status");
    $("#connection").textContent = "Server lokal aktif";
    $("#connection").classList.add("online");
    $("#workspace-path").textContent = status.workspace;
    await loadProjects();
  } catch {
    $("#connection").textContent = "Server tidak terhubung";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function buildPreviewDocument(lines) {
  const paragraphs = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n");
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Preview Konten</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: clamp(24px, 5vw, 64px);
      color: #20242b;
      background: #fff;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }
    main { width: min(100%, 900px); margin: 0 auto; }
    p { margin: 0 0 1em; }
    p:last-child { margin-bottom: 0; }
  </style>
</head>
<body><main>${paragraphs}</main></body>
</html>`;
}

initializeTheme();
$("#create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#project-name");
  const name = input.value.trim();
  if (!name) return;
  try {
    await api("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
    input.value = "";
    showMessage("Proyek berhasil dibuat.", false);
    await loadProjects();
  } catch (error) {
    showMessage(error.message);
  }
});

$("#refresh").addEventListener("click", loadProjects);
initialize();

async function renderSheet(url) {
  const message = $("#sheet-message");
  const result = $("#sheet-result");
  const preview = $("#sheet-preview");
  const count = $("#sheet-count");
  message.textContent = "Mengambil data spreadsheet…";
  message.classList.remove("success");
  result.hidden = true;

  try {
    const data = await api("/api/render-sheet", {
      method: "POST",
      body: JSON.stringify({ url })
    });

    preview.srcdoc = buildPreviewDocument(data.lines);
    count.textContent = data.lines.length + " baris teks";
    result.hidden = false;
    message.textContent = "Spreadsheet berhasil diterjemahkan.";
    message.classList.add("success");
  } catch (error) {
    message.textContent = error.message;
  }
}

$("#sheet-form").addEventListener("submit", (event) => {
  event.preventDefault();
  renderSheet($("#sheet-url").value.trim());
});
