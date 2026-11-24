const $ = (selector) => document.querySelector(selector);

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
  element.style.color = isError ? "#b04444" : "#198754";
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
