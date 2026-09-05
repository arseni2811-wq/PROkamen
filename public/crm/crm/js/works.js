let projects = [];
let materials = [];
let editing = null;
let slugTouched = false;
const byId = (id) => document.getElementById(id);
const form = byId("workForm");
const field = (name) => form.elements.namedItem(name);
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function notify(message, error = false) {
  const toast = byId("toast"); toast.textContent = message;
  toast.className = `fixed right-5 bottom-5 z-50 px-5 py-3 rounded-lg shadow-xl text-white ${error ? "bg-red-600" : "bg-emerald-600"}`;
  setTimeout(() => toast.classList.add("hidden"), 3500);
}
function slugify(value) {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return String(value || "").toLowerCase().split("").map((char) => map[char] ?? char).join("")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}
function materialLabel(project) {
  return project.material_name_snapshot || project.material_title || "Не указан";
}
function payloadFrom(source, published = source.published) {
  const keys = ["title","slug","description","short_description","location","work_type","work_details","work_category","material_category","material_id","material_name_snapshot","public_sort_order","seo_title","seo_description"];
  return { ...Object.fromEntries(keys.map((key) => [key, source[key] ?? null])), published: Boolean(published) };
}
function currentPayload() {
  const data = Object.fromEntries(new FormData(form).entries());
  return { ...data, published: field("published").checked, public_sort_order: Number(data.public_sort_order || 0),
    material_id: data.material_id || null };
}
function fillMaterials() {
  const select = field("material_id");
  select.replaceChildren(new Option("Другой / отсутствует в базе", ""));
  for (const material of materials) {
    select.add(new Option([material.fabricator, material.material_id, material.title].filter(Boolean).join(" · "), material.material_id));
  }
  const filter = byId("materialFilter");
  const values = [...new Set(projects.map(materialLabel).filter(Boolean))].sort();
  filter.replaceChildren(new Option("Все материалы", ""), ...values.map((value) => new Option(value, value)));
}
function render() {
  const query = byId("searchInput").value.trim().toLowerCase();
  const status = byId("statusFilter").value; const material = byId("materialFilter").value;
  const visible = projects.filter((project) => {
    if (query && !`${project.title} ${project.location || ""}`.toLowerCase().includes(query)) return false;
    if (status === "published" && !project.published) return false;
    if (status === "draft" && project.published) return false;
    return !material || materialLabel(project) === material;
  });
  byId("emptyState").classList.toggle("hidden", visible.length > 0);
  byId("worksBody").innerHTML = visible.map((project) => {
    const cover = project.images.find((image) => image.is_cover) || project.images[0];
    return `<tr class="hover:bg-gray-50"><td class="p-3">${cover ? `<a href="${escapeHtml(api.resolveUrl(cover.url))}" target="_blank"><img src="${escapeHtml(api.resolveUrl(cover.url))}" alt="" class="w-24 h-16 object-cover rounded"></a>` : '<span class="text-gray-400">Нет фото</span>'}</td>
      <td class="p-3 font-semibold max-w-xs">${escapeHtml(project.title)}</td><td class="p-3">${escapeHtml(materialLabel(project))}</td><td class="p-3">${escapeHtml(project.work_type)}</td><td class="p-3">${escapeHtml(project.location || "—")}</td>
      <td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${project.published ? "bg-emerald-100 text-emerald-800" : "bg-gray-200"}">${project.published ? "Опубликован" : "Черновик"}</span></td><td class="p-3">${project.public_sort_order}</td><td class="p-3">${new Date(project.updated_at).toLocaleString("ru-RU")}</td>
      <td class="p-3"><div class="flex flex-col items-start gap-1"><button data-edit="${project.project_id}" class="text-blue-700 hover:underline">Редактировать</button><button data-toggle="${project.project_id}" class="text-emerald-700 hover:underline">${project.published ? "Скрыть" : "Опубликовать"}</button><button data-archive="${project.project_id}" class="text-red-700 hover:underline">Архивировать</button></div></td></tr>`;
  }).join("");
}
function renderImages() {
  const images = editing?.images || [];
  byId("imageGrid").innerHTML = images.map((image, index) => `<article class="border rounded-lg p-2" data-image="${image.image_id}"><a href="${escapeHtml(api.resolveUrl(image.url))}" target="_blank"><img src="${escapeHtml(api.resolveUrl(image.url))}" alt="" class="w-full aspect-[4/3] object-cover rounded"></a><label class="flex items-center gap-2 mt-2 text-xs"><input type="radio" name="coverImage" value="${image.image_id}" ${image.is_cover ? "checked" : ""}> Обложка</label><input data-alt class="mt-2 w-full border rounded px-2 py-1 text-xs" maxlength="255" placeholder="Alt фотографии" value="${escapeHtml(image.alt_text || "")}"><div class="flex gap-2 mt-2"><button type="button" data-up="${image.image_id}" ${index === 0 ? "disabled" : ""} class="border rounded px-2 disabled:opacity-30">↑</button><button type="button" data-down="${image.image_id}" ${index === images.length - 1 ? "disabled" : ""} class="border rounded px-2 disabled:opacity-30">↓</button><button type="button" data-delete-image="${image.image_id}" class="ml-auto text-red-700">Удалить</button></div></article>`).join("") || '<p class="text-sm text-gray-500">После первого сохранения можно загрузить фотографии.</p>';
}
function openEditor(project = null) {
  editing = project ? structuredClone(project) : null; slugTouched = Boolean(project);
  form.reset(); field("public_sort_order").value = project?.public_sort_order ?? projects.length;
  for (const [key, value] of Object.entries(project || {})) {
    const control = field(key); if (!control) continue;
    if (control.type === "checkbox") control.checked = Boolean(value); else control.value = value ?? "";
  }
  byId("editorTitle").textContent = project ? "Редактирование работы" : "Новая работа";
  byId("imageInput").disabled = !project; renderImages(); byId("editor").showModal();
}
async function load() {
  const [portfolioResponse, materialResponse] = await Promise.all([api.getPortfolio(), api.getMaterials()]);
  projects = portfolioResponse.projects || []; materials = materialResponse.materials || [];
  fillMaterials(); render();
}
async function saveImagesMetadata() {
  if (!editing?.images.length) return;
  const cards = [...byId("imageGrid").querySelectorAll("[data-image]")];
  const selected = Number(form.querySelector('input[name="coverImage"]:checked')?.value || editing.images[0].image_id);
  const images = cards.map((card, index) => ({ image_id: Number(card.dataset.image), sort_order: index,
    is_cover: Number(card.dataset.image) === selected, alt_text: card.querySelector("[data-alt]").value.trim() || null }));
  const response = await api.savePortfolioImageOrder(editing.project_id, images); editing = response.project;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault(); const saveButton = byId("saveBtn"); saveButton.disabled = true;
  try {
    const data = currentPayload(); const changedPublishedSlug = editing?.published && data.slug !== editing.slug;
    if (changedPublishedSlug && !confirm("Изменение slug поменяет публичный URL. Продолжить?")) return;
    if (editing) await saveImagesMetadata();
    const requestedPublish = data.published;
    if (!editing && requestedPublish) data.published = false;
    let response = editing ? await api.updatePortfolioProject(editing.project_id, data) : await api.createPortfolioProject(data);
    editing = response.project;
    const files = byId("imageInput").files;
    if (files.length) { response = await api.uploadPortfolioImages(editing.project_id, files); editing = response.project; }
    if (requestedPublish && !editing.published) {
      response = await api.updatePortfolioProject(editing.project_id, { ...currentPayload(), published: true }); editing = response.project;
    }
    notify("Работа сохранена"); byId("editor").close(); await load();
  } catch (error) { notify(error.message, true); } finally { saveButton.disabled = false; }
});
byId("worksBody").addEventListener("click", async (event) => {
  const editId = Number(event.target.dataset.edit); const toggleId = Number(event.target.dataset.toggle); const archiveId = Number(event.target.dataset.archive);
  try {
    if (editId) return openEditor(projects.find((project) => project.project_id === editId));
    if (toggleId) { const project = projects.find((item) => item.project_id === toggleId); await api.updatePortfolioProject(toggleId, payloadFrom(project, !project.published)); notify(project.published ? "Работа скрыта" : "Работа опубликована"); await load(); }
    if (archiveId && confirm("Переместить работу в архив? После следующего экспорта она исчезнет с публичного сайта.")) { await api.archivePortfolioProject(archiveId); notify("Работа перемещена в архив"); await load(); }
  } catch (error) { notify(error.message, true); }
});
byId("imageGrid").addEventListener("click", async (event) => {
  const imageId = Number(event.target.dataset.up || event.target.dataset.down || event.target.dataset.deleteImage); if (!imageId) return;
  const index = editing.images.findIndex((image) => image.image_id === imageId);
  try {
    if (event.target.dataset.deleteImage && confirm("Удалить эту фотографию?")) { const response = await api.deletePortfolioImage(editing.project_id, imageId); editing = response.project; renderImages(); return; }
    const target = event.target.dataset.up ? index - 1 : index + 1;
    [editing.images[index], editing.images[target]] = [editing.images[target], editing.images[index]]; renderImages();
  } catch (error) { notify(error.message, true); }
});
field("title").addEventListener("input", () => { if (!slugTouched) field("slug").value = slugify(field("title").value); });
field("slug").addEventListener("input", () => { slugTouched = true; field("slug").value = slugify(field("slug").value); });
byId("addBtn").addEventListener("click", () => openEditor());
byId("closeEditor").addEventListener("click", () => byId("editor").close()); byId("cancelEditor").addEventListener("click", () => byId("editor").close());
["searchInput","statusFilter","materialFilter"].forEach((id) => byId(id).addEventListener("input", render));
byId("logoutBtn").addEventListener("click", async () => { try { await api.logout(); } finally { Store.clear(); location.href = "login.html"; } });
const user = Store.getUser();
if (!user || Number(user.role_id) !== 1) location.href = "dashboard.html"; else load().catch((error) => notify(error.message, true));
