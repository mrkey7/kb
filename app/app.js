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
  preview.replaceChildren();

  try {
    const data = await api("/api/render-sheet", {
      method: "POST",
      body: JSON.stringify({ url })
    });

    for (const line of data.lines) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      preview.append(paragraph);
    }

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
