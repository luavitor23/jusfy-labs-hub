// Salvar, listar e reabrir mestres aprovados (SVG + prévia PNG + mapa de layout).
import { $, canvas, state, fields, templates } from "./state.js";
import { createLayout, currentLayout } from "./catalog.js";
import { render, saveLocal, updateCounters, liveSvgText, overlaySvg, captureFamilyFields } from "./render.js";
import { currentValues } from "./draw.js";
import { ensureCurrentOfferLoaded, renderOfferBank } from "./assets-banks.js";
import { loadTemplate } from "./template-loader.js";
import { showError } from "./errors.js";

export async function saveApprovedMaster() {
  const button = $("saveMasterButton"); const status = $("masterSaveStatus");
  if (!$("masterApproval").checked) { status.textContent = "Confirme a revisão humana deste formato antes de salvar."; status.className = "master-status error"; return; }
  const spec = templates[state.template]; const values = currentValues(); const name = $("masterNameInput").value.trim() || spec.name;
  button.disabled = true; button.textContent = "Salvando mestre…"; status.textContent = "Gerando SVG, prévia e mapa do layout…"; status.className = "master-status";
  try {
    let svg = state.sourceText;
    if (spec.type === "live") svg = liveSvgText(); else if (spec.type === "mapped") svg = overlaySvg(spec, values);
    await render(false);
    const response = await fetch("/api/masters", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ name, format:state.template, width:spec.width, height:spec.height, sourceName:state.sourceName, fields:values, layout:spec.type === "mapped" ? currentLayout() : null, svg, previewPng:canvas.toDataURL("image/png") }),
    });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível salvar o mestre.");
    status.textContent = `Mestre salvo em ${result.folder}`; status.className = "master-status success"; $("masterApproval").checked = false;
    loadMasters().catch((refreshError) => console.warn(refreshError));
  } catch (error) {
    status.textContent = error.message || "Não foi possível salvar o mestre."; status.className = "master-status error";
  } finally {
    button.disabled = false; button.textContent = "Salvar como mestre"; render();
  }
}

function masterFormatLabel(templateKey) {
  const format = templates[templateKey]?.format || (String(templateKey).toLowerCase().includes("story") ? "story" : "square");
  return format === "story" ? "9:16" : "1:1";
}

export async function loadMasters() {
  const status = $("mastersMessage");
  status.classList.remove("error");
  try {
    const response = await fetch("/api/masters");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os mestres salvos. Reinicie o servidor local para ativar a rota /api/masters.");
    state.masters = payload.items || []; renderMastersList();
  } catch (error) {
    console.error(error); status.textContent = error.message || "Não foi possível carregar os mestres salvos."; status.classList.add("error");
  }
}

export function renderMastersList() {
  const host = $("mastersList"); host.replaceChildren();
  state.masters.forEach((item) => {
    const card = document.createElement("article"); card.className = "master-card";
    const thumb = document.createElement("span"); thumb.className = "master-thumb";
    if (item.previewUrl) { const img = document.createElement("img"); img.src = item.previewUrl; img.alt = `Prévia de ${item.name}`; img.loading = "lazy"; thumb.append(img); }
    const content = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = item.name;
    const meta = document.createElement("small");
    const savedLabel = item.savedAt ? new Date(item.savedAt).toLocaleString("pt-BR") : "data desconhecida";
    meta.textContent = `${masterFormatLabel(item.format)} · ${savedLabel}`;
    content.append(title, meta);
    const reopen = document.createElement("button"); reopen.type = "button"; reopen.textContent = "Reabrir"; reopen.title = "Aplicar este mestre ao editor";
    reopen.addEventListener("click", () => reopenMaster(item).catch(showError));
    card.append(thumb, content, reopen); host.append(card);
  });
  $("mastersMessage").textContent = state.masters.length ? `${state.masters.length} mestre(s) salvo(s).` : "Nenhum mestre salvo ainda.";
}

async function reopenMaster(item) {
  const meta = item.layout || {};
  const templateKey = templates[meta.format] ? meta.format : null;
  if (templateKey && state.template !== templateKey) { captureFamilyFields(); await loadTemplate(templateKey); }
  const savedFields = meta.fields || {};
  Object.entries(fields).forEach(([key, field]) => { if (Object.hasOwn(savedFields, key) && typeof savedFields[key] === "string") field.value = savedFields[key]; });
  state.selectedBatch = -1; state.selection = null;
  if (templateKey && meta.layout && typeof meta.layout === "object") {
    const merged = createLayout(templateKey);
    Object.entries(meta.layout).forEach(([key, value]) => {
      if (key === "commercialOffer" && typeof value === "string") { merged[key] = value; return; }
      if (merged[key] && value && typeof value === "object") merged[key] = { ...merged[key], ...value };
    });
    state.layouts[templateKey] = merged;
  }
  if (meta.name) $("masterNameInput").value = String(meta.name).slice(0, 80);
  await ensureCurrentOfferLoaded(); renderOfferBank();
  updateCounters(); saveLocal(); await render();
  $("mastersMessage").classList.remove("error");
  $("mastersMessage").textContent = templateKey ? `Mestre "${item.name}" aplicado ao editor.` : `Mestre "${item.name}" aplicado apenas nos textos (formato original não está no catálogo).`;
}
