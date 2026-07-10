const STORAGE_KEY = "glerm_images_metadata_v1";

const form = document.querySelector("#imageForm");
const imageFile = document.querySelector("#imageFile");
const imagePreview = document.querySelector("#imagePreview");
const previewCaption = document.querySelector("#previewCaption");
const jsonOutput = document.querySelector("#jsonOutput");
const recordsList = document.querySelector("#recordsList");
const jsonFile = document.querySelector("#jsonFile");

let records = loadRecords();
let selectedPreview = "";

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.warn("Não foi possível ler os registros locais.", error);
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records, null, 2));
  render();
}

function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "imagem";
}

function makeRecord() {
  const fileName = document.querySelector("#fileName").value.trim();
  const title = document.querySelector("#title").value.trim();
  const page = document.querySelector("#page").value;
  const section = document.querySelector("#section").value.trim();
  const year = document.querySelector("#year").value.trim();
  const location = document.querySelector("#location").value.trim();
  const description = document.querySelector("#description").value.trim();
  const tags = document.querySelector("#tags").value
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
  const credit = document.querySelector("#credit").value.trim();
  const id = `${slugify(section || page)}-${slugify(title)}-${Date.now()}`;

  return {
    id,
    title,
    file: `assets/img/${fileName}`,
    page,
    section,
    year: year ? Number(year) : null,
    location,
    description,
    tags,
    credit,
    alt: description || title,
    createdAt: new Date().toISOString()
  };
}

function clearForm() {
  form.reset();
  selectedPreview = "";
  imagePreview.innerHTML = "<span>prévia da imagem</span>";
  previewCaption.textContent = "Nenhuma imagem selecionada.";
}

function render() {
  const json = JSON.stringify(records, null, 2);
  jsonOutput.value = json;

  if (!records.length) {
    recordsList.innerHTML = `<p class="notice">Nenhum registro cadastrado ainda.</p>`;
    return;
  }

  recordsList.innerHTML = records.map((record, index) => `
    <article class="record-card">
      <div>
        <h3>${record.title}</h3>
        <p><strong>Arquivo:</strong> <code>${record.file}</code></p>
        <p><strong>Página:</strong> <code>${record.page}</code> · <strong>Seção:</strong> ${record.section || "—"}</p>
        <p><strong>Ano:</strong> ${record.year || "—"} · <strong>Local:</strong> ${record.location || "—"}</p>
        <p>${record.description || "Sem descrição."}</p>
        <p class="tag-line">${record.tags.map(tag => `<span>${tag}</span>`).join("")}</p>
      </div>
      <div class="record-actions">
        <button class="button secondary" type="button" data-edit="${index}">Editar</button>
        <button class="button danger" type="button" data-delete="${index}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "images.json";
  link.click();
  URL.revokeObjectURL(url);
}

function fillForm(record, index) {
  document.querySelector("#fileName").value = record.file.replace("assets/img/", "");
  document.querySelector("#title").value = record.title || "";
  document.querySelector("#page").value = record.page || "index.html";
  document.querySelector("#section").value = record.section || "";
  document.querySelector("#year").value = record.year || "";
  document.querySelector("#location").value = record.location || "";
  document.querySelector("#description").value = record.description || "";
  document.querySelector("#tags").value = (record.tags || []).join(", ");
  document.querySelector("#credit").value = record.credit || "";
  records.splice(index, 1);
  saveRecords();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

imageFile.addEventListener("change", () => {
  const file = imageFile.files[0];
  if (!file) return;

  document.querySelector("#fileName").value = file.name;
  selectedPreview = URL.createObjectURL(file);
  imagePreview.innerHTML = `<img src="${selectedPreview}" alt="Prévia da imagem selecionada" />`;
  previewCaption.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  records.unshift(makeRecord());
  saveRecords();
  clearForm();
});

document.querySelector("#clearForm").addEventListener("click", clearForm);
document.querySelector("#exportJson").addEventListener("click", downloadJson);

document.querySelector("#copyJson").addEventListener("click", async () => {
  await navigator.clipboard.writeText(jsonOutput.value);
  alert("JSON copiado para a área de transferência.");
});

document.querySelector("#importJson").addEventListener("click", () => jsonFile.click());

jsonFile.addEventListener("change", async () => {
  const file = jsonFile.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("O JSON precisa ser uma lista de imagens.");
    records = imported;
    saveRecords();
  } catch (error) {
    alert(`Erro ao importar JSON: ${error.message}`);
  }
});

document.querySelector("#clearAll").addEventListener("click", () => {
  const ok = confirm("Apagar todos os registros salvos localmente neste navegador?");
  if (!ok) return;
  records = [];
  saveRecords();
});

recordsList.addEventListener("click", (event) => {
  const editIndex = event.target.dataset.edit;
  const deleteIndex = event.target.dataset.delete;

  if (editIndex !== undefined) {
    fillForm(records[Number(editIndex)], Number(editIndex));
  }

  if (deleteIndex !== undefined) {
    records.splice(Number(deleteIndex), 1);
    saveRecords();
  }
});

render();
