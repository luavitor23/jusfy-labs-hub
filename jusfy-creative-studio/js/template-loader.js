// Carregamento de modelo/formato, importação de SVG externo e diagnóstico de saúde do arquivo.
import { $, canvas, state, fields, defaults, templates, designFamilies, familyFieldDefaults, textKeys } from "./state.js";
import { templateKeyFor, updateCopyFieldsNotice } from "./catalog.js";
import { parseSvg, svgDimensions, readFile, ensureEmbeddedFontUrls, embedPoppinsInSvg, loadImage, safeName } from "./svg-io.js";
import { render, scheduleRender, saveLocal, captureFamilyFields, updateCounters } from "./render.js";
import { fitZoom } from "./interaction.js";
import { updateCobrandingUi, updateOfferSectionUi, renderOfferBank, ensureCurrentOfferLoaded, selectCatalogLogo, regionalize } from "./assets-banks.js";
import { renderCopyLibrary } from "./copies.js";
import { showError } from "./errors.js";

export function applyFamilyFields(family) { const values = state.familyFields[family] || familyFieldDefaults[family] || defaults; Object.entries(fields).forEach(([key,field]) => { field.value = regionalize(values[key] ?? ""); }); updateCounters(); }

export async function setSource(svgText, name, custom = false) {
  let doc = parseSvg(svgText);
  if (doc.querySelector("text")) { await ensureEmbeddedFontUrls(); svgText = embedPoppinsInSvg(svgText); doc = parseSvg(svgText); }
  const dims = svgDimensions(doc);
  state.sourceText = svgText; state.sourceName = name; state.custom = custom;
  state.liveTextNodes = [...doc.querySelectorAll("text")].map((node, index) => {
    const tspans = [...node.querySelectorAll("tspan")]; const lines = tspans.length ? tspans.map((item) => item.textContent.trim()) : [node.textContent.trim()];
    return { index, value:lines.join("\n"), lineCount:Math.max(1,tspans.length) };
  });
  state.liveImageNodes = [...doc.querySelectorAll("image")].map((node, index) => ({ index, href: node.getAttribute("href") || node.getAttribute("xlink:href") || "" }));
  if (custom) {
    templates.custom = { name, width: dims.width, height: dims.height, type: state.liveTextNodes.length ? "live" : "flat", source: null };
    state.template = "custom";
  }
  state.selection = null; state.drag = null;
  state.sourceImage = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`);
  Object.keys(state.freeElementCrops).forEach((cacheKey) => { if (cacheKey.startsWith(`${state.template}:`)) delete state.freeElementCrops[cacheKey]; });
  buildDetectedFields(); updateHealth(); updateUi(); render();
}

export async function loadTemplate(key) {
  state.template = key; state.family = templates[key].family || state.family; state.format = templates[key].format || state.format; state.custom = false; state.selectedBatch = -1; state.selection = null; state.drag = null;
  $("loadingState").classList.remove("is-hidden");
  const imported = state.importedSources[key]; let svgText; let name = templates[key].name;
  if (imported) { svgText = imported.text; name = imported.name; state.importMode = imported.mode || "original"; }
  else {
    state.importMode = "mapped";
    const response = await fetch(templates[key].source);
    if (!response.ok) throw new Error("Não foi possível abrir o SVG do template.");
    svgText = await response.text();
  }
  await setSource(svgText, name, false);
  await ensureCurrentOfferLoaded();
  render();
  updateImportModeUi();
  $("resetButton").textContent = state.family === "conditions" ? "Restaurar copy aprovada" : "Restaurar textos do modelo";
  updateCobrandingUi();
  updateOfferSectionUi(); renderOfferBank();
  $("familySelect").value = state.family; $("familyDescription").textContent = designFamilies[state.family]?.description || "";
  document.querySelectorAll("[data-format]").forEach((button) => button.classList.toggle("is-active", button.dataset.format === state.format));
}

export async function selectFamily(family) {
  captureFamilyFields(); state.family = family; applyFamilyFields(family); updateCopyFieldsNotice(); if (state.copies.length) renderCopyLibrary(); saveLocal(); await loadTemplate(templateKeyFor(family,state.format));
}

export async function selectFormat(format) { state.format = format; saveLocal(); await loadTemplate(templateKeyFor(state.family,format)); }

async function importMappedTemplate(key, file) {
  if (!file) return; const svgText = await readFile(file); const doc = parseSvg(svgText); const dims = svgDimensions(doc); const ratio = dims.width / dims.height;
  const expectedRatio = templates[key].width / templates[key].height; const format = templates[key].format || key; const label = format === "square" ? "1:1" : "9:16";
  if (Math.abs(ratio - expectedRatio) > .025) throw new Error(`O arquivo ${file.name} não corresponde ao formato ${label}.`);
  state.importedSources[key] = { name:file.name, text:svgText, width:dims.width, height:dims.height, mode:"mapped" };
  $(`${format}ImportName`).textContent = file.name; await loadTemplate(key);
  const filename = safeName(file.name).replaceAll("-","");
  const regional = state.logoCatalog.find((item) => item.target === "regional" && filename.includes(safeName(item.id).replaceAll("-","")));
  if (regional) await selectCatalogLogo(regional);
  const status = $("importStatus");
  status.textContent = `${file.name} carregado em ${label} · textos controlados pelo mapa do Studio.`;
  status.className = "import-status success";
}

export async function handleTemplateImport(key, file) {
  if (!file) return; const status = $("importStatus"); status.textContent = `Carregando ${file.name}…`; status.className = "import-status";
  try { await importMappedTemplate(key,file); }
  catch (error) { status.textContent = error.message || "Não foi possível carregar o SVG."; status.className = "import-status error"; showError(error); }
}

export function updateImportModeUi() {
  const imported = state.importedSources[state.template]; $("importModeControls").hidden = !imported;
  $("originalModeButton").classList.toggle("is-active", Boolean(imported && state.importMode === "original"));
  $("mappedModeButton").classList.toggle("is-active", Boolean(imported && state.importMode === "mapped"));
}

export function setImportMode(mode) {
  const imported = state.importedSources[state.template]; if (!imported) return; state.importMode = mode; imported.mode = mode; state.selection = null;
  buildDetectedFields(); updateHealth(); updateImportModeUi(); render();
  const status = $("importStatus");
  status.textContent = mode === "original" ? "Original editável ativo: o arquivo é exibido sem substituições." : "Modelo protegido ativo: o Studio reconstrói copy, bloco comercial e logos pelo mapa.";
  status.className = "import-status success";
}

export function buildDetectedFields() {
  const host = $("detectedFields"); host.replaceChildren();
  const importedOriginal = Boolean(state.importedSources[state.template] && state.importMode === "original");
  const isLive = Boolean((state.custom || importedOriginal) && state.liveTextNodes.length);
  const isUnmapped = Boolean((state.custom || importedOriginal) && !state.liveTextNodes.length);
  const enabled = templates[state.template]?.enabledFields || textKeys;
  Object.entries(fields).forEach(([key,field]) => field.closest(".field").hidden = isLive || isUnmapped || (!importedOriginal && !enabled.includes(key)));
  host.hidden = !isLive && !isUnmapped;
  if (isUnmapped) {
    const warning = document.createElement("div"); warning.className = "unmapped-warning";
    warning.innerHTML = importedOriginal ? "<strong>Visual original preservado</strong><span>Este SVG não possui texto vivo: as palavras são curvas. Use Campos editáveis para reconstruir copy e logos pelo mapa.</span>" : "<strong>Este SVG precisa ser mapeado</strong><span>Os campos de copy foram desativados porque o arquivo não possui texto vivo.</span>";
    host.append(warning); return;
  }
  if (!isLive) return;
  const title = document.createElement("p"); title.className = "detected-title"; title.textContent = `${state.liveTextNodes.length} camada(s) de texto detectada(s)`; host.append(title);
  state.liveTextNodes.forEach((item) => {
    const label = document.createElement("label"); label.className = "field";
    const caption = document.createElement("span"); caption.textContent = `Texto ${item.index + 1}`;
    const input = document.createElement("textarea"); input.rows = 2; input.value = item.value; input.dataset.liveText = item.index;
    input.addEventListener("input", () => { item.value = input.value; scheduleRender(); });
    label.append(caption, input); host.append(label);
  });
}

export function updateHealth() {
  const box = $("svgHealth"); const textCount = state.liveTextNodes.length; const imageCount = state.liveImageNodes.length;
  const original = Boolean(state.importedSources[state.template] && state.importMode === "original"); const mapped = templates[state.template]?.type === "mapped" && !original;
  box.className = `health ${textCount || mapped ? "success" : "warning"}`;
  box.querySelector("i").textContent = textCount || mapped ? "✓" : "!";
  box.querySelector("strong").textContent = original ? textCount ? "SVG original com texto vivo" : "SVG original vetorizado" : mapped ? "Template editável por mapa" : textCount ? "SVG editável" : "SVG vetorizado";
  box.querySelector("span").textContent = original
    ? textCount ? `${textCount} camada(s) de texto editável(is), mantendo o restante original.` : "Visual preservado exatamente; a copy está em curvas e não contém palavras editáveis."
    : mapped
    ? state.importedSources[state.template] ? "SVG importado como base. Copy, logos e bloco mapeado continuam editáveis." : "Copy original convertida em curvas. Usando os campos mapeados do piloto."
    : textCount ? `${textCount} texto(s) e ${imageCount} imagem(ns) detectados como camadas.` : "Nenhum texto vivo. O arquivo pode ser usado como base, mas precisa de um mapa de campos.";
}

export function updateUi() {
  const spec = templates[state.template];
  canvas.width = spec.width; canvas.height = spec.height;
  $("documentName").textContent = state.sourceName || spec.name; $("sizeLabel").textContent = `${spec.width} × ${spec.height} px`;
  updateCounters(); fitZoom();
}
