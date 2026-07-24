// Geração de variações em massa (por regional, por copy ou CSV manual), fila de revisão e export ZIP.
import { $, canvas, state, fields, templates, designFamilies } from "./state.js";
import { familyCobranding, copyFieldsFor } from "./catalog.js";
import { regionalizeFor, selectedRegionalLogos, catalogAssetDataUrl, renderLogoBank, ensureCobrandForRegionals } from "./assets-banks.js";
import { visibleCopies } from "./copies.js";
import { render } from "./render.js";
import { safeName, download, loadImage } from "./svg-io.js";

export function variationForLogo(values, logo, name, copySlug = "") {
  const region = logo.region || "OAB/SP";
  return { name:`${name} · ${region}`, category:values.category, headline:regionalizeFor(values.headline,region), support:regionalizeFor(values.support,region), cta:regionalizeFor(values.cta,region), logoId:logo.id, region, copySlug, review:"pending", thumb:"" };
}

export async function activateBatchLogo(item) {
  const logo = state.logoCatalog.find((candidate) => candidate.id === item?.logoId && candidate.target === "regional"); if (!logo) return;
  const url = await catalogAssetDataUrl(logo); state.logoUrls.regional = url; state.logos.regional = await loadImage(url);
  state.selectedLogoId = logo.id; state.selectedRegion = logo.region || item.region || state.selectedRegion; state.regionalIsLockup = logo.sourceKind === "file-svg"; $("regionalLogoName").textContent = logo.name; renderLogoBank();
}

export async function generateLogoVariations() {
  const logos = selectedRegionalLogos(false);
  if (!logos.length) { $("logoBankStatus").textContent = "Selecione ao menos uma regional para gerar o lote."; return; }
  const modeNotice = ensureCobrandForRegionals();
  const values = { category:fields.category.value, headline:fields.headline.value, support:fields.support.value, cta:fields.cta.value };
  state.batch = logos.map((logo) => variationForLogo(values,logo,templates[state.template].name,safeName(templates[state.template].name))); state.selectedBatch = 0;
  await activateBatchLogo(state.batch[0]); renderBatchList(); render();
  $("logoBankStatus").textContent = `${state.batch.length} variação(ões) regional(is) gerada(s).${modeNotice}`;
  await generateBatchThumbs();
}

export async function generateNotionVariations() {
  const selected = visibleCopies().filter((item) => state.copySelection.has(item.id));
  if (!selected.length) { $("copyLibraryStatus").textContent = "Selecione ao menos uma copy para gerar as variações."; return; }
  const allowedCopyFields = copyFieldsFor(state.family);
  const valuesForCopy = (item) => {
    const values = { category:fields.category.value, headline:fields.headline.value, support:fields.support.value, cta:fields.cta.value };
    allowedCopyFields.forEach((name) => { values[name] = item[name]; });
    return values;
  };
  if (!familyCobranding()) {
    state.batch = selected.map((item) => {
      const values = valuesForCopy(item);
      return { name:item.variation, category:values.category, headline:values.headline, support:values.support, cta:values.cta, copySlug:safeName(item.variation), review:"pending", thumb:"" };
    });
    state.selectedBatch = 0; renderBatchList(); render();
    $("copyLibraryStatus").textContent = `${state.batch.length} variação(ões) gerada(s): 1 por copy (modelo sem co-branding).`;
    await generateBatchThumbs();
    return;
  }
  const logos = selectedRegionalLogos(true);
  const modeNotice = ensureCobrandForRegionals();
  if (modeNotice) $("logoBankStatus").textContent = modeNotice.trim();
  state.batch = selected.flatMap((item) => logos.map((logo) => variationForLogo(valuesForCopy(item),logo,item.variation,safeName(item.variation))));
  state.selectedBatch = 0; await activateBatchLogo(state.batch[0]); renderBatchList(); render();
  $("copyLibraryStatus").textContent = `${state.batch.length} variação(ões) gerada(s): ${selected.length} copy(ies) × ${logos.length} regional(is).`;
  await generateBatchThumbs();
}

function thumbFromCanvas() {
  const width = 150; const height = Math.max(1, Math.round(canvas.height * (width / canvas.width)));
  const small = document.createElement("canvas"); small.width = width; small.height = height;
  small.getContext("2d").drawImage(canvas, 0, 0, width, height);
  return small.toDataURL("image/png");
}

export async function generateBatchThumbs() {
  if (!state.batch.length) return;
  const previous = state.selectedBatch; const previousLogoId = state.selectedLogoId;
  for (let index = 0; index < state.batch.length; index += 1) {
    if (state.batch[index].thumb) continue;
    $("batchMessage").textContent = `Gerando miniaturas ${index + 1}/${state.batch.length}…`;
    state.selectedBatch = index; await activateBatchLogo(state.batch[index]); await render(false);
    state.batch[index].thumb = thumbFromCanvas();
  }
  state.selectedBatch = previous;
  if (previous >= 0 && state.batch[previous]) await activateBatchLogo(state.batch[previous]);
  else if (previousLogoId) await activateBatchLogo({ logoId:previousLogoId });
  renderBatchList(); render();
}

export function reviewCounts() {
  let approved = 0, rejected = 0, pending = 0;
  state.batch.forEach((item) => { if (item.review === "approved") approved += 1; else if (item.review === "rejected") rejected += 1; else pending += 1; });
  return { approved, rejected, pending };
}

export function setReview(item, value) { item.review = item.review === value ? "pending" : value; renderBatchList(); }

export function renderBatchList() {
  const host = $("batchList"); host.replaceChildren();
  state.batch.forEach((item, index) => {
    if (!item.review) item.review = "pending";
    const card = document.createElement("div"); card.className = `batch-item review-${item.review}${index === state.selectedBatch ? " is-active" : ""}`;
    const number = document.createElement("i"); number.textContent = String(index + 1).padStart(2,"0");
    const thumbBox = document.createElement("span"); thumbBox.className = "batch-thumb"; thumbBox.title = "Ver na prévia";
    if (item.thumb) { const img = document.createElement("img"); img.src = item.thumb; img.alt = item.name; thumbBox.append(img); }
    const content = document.createElement("span"); content.className = "batch-item-info"; const title = document.createElement("strong"); title.textContent = item.name; const copy = document.createElement("small"); copy.textContent = item.headline; content.append(title,copy);
    const controls = document.createElement("span"); controls.className = "batch-review-buttons";
    const approve = document.createElement("button"); approve.type = "button"; approve.className = `review-button approve${item.review === "approved" ? " is-on" : ""}`; approve.textContent = "✓"; approve.title = "Aprovar";
    approve.addEventListener("click", (event) => { event.stopPropagation(); setReview(item, "approved"); });
    const reject = document.createElement("button"); reject.type = "button"; reject.className = `review-button reject${item.review === "rejected" ? " is-on" : ""}`; reject.textContent = "✕"; reject.title = "Rejeitar";
    reject.addEventListener("click", (event) => { event.stopPropagation(); setReview(item, "rejected"); });
    controls.append(approve,reject);
    card.append(number,thumbBox,content,controls);
    card.addEventListener("click", async () => { state.selectedBatch = index; await activateBatchLogo(item); renderBatchList(); render(); }); host.append(card);
  });
  const counts = reviewCounts();
  $("batchReviewBar").hidden = !state.batch.length;
  $("batchReviewSummary").textContent = `${counts.approved} aprovadas · ${counts.rejected} rejeitadas · ${counts.pending} pendentes`;
  $("batchMessage").textContent = state.batch.length ? `${state.batch.length} versão(ões) pronta(s). Selecione para revisar.` : "Nenhuma variação gerada.";
  $("exportBatchButton").hidden = !state.batch.length;
}

function canvasPngBytes() {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      try {
        if (blob) { resolve(new Uint8Array(await blob.arrayBuffer())); return; }
        const base64 = canvas.toDataURL("image/png").split(",")[1]; const binary = atob(base64);
        const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        resolve(bytes);
      } catch (error) { reject(error); }
    }, "image/png");
  });
}

export async function exportApprovedBatch() {
  if (!state.batch.length) return;
  const counts = reviewCounts();
  $("batchMessage").classList.remove("error");
  if (counts.pending) { $("batchMessage").textContent = `Há ${counts.pending} variações pendentes de revisão. Aprove ou rejeite antes de exportar.`; return; }
  if (!counts.approved) { $("batchMessage").textContent = "Nenhuma variação aprovada para exportar."; return; }
  const previous = state.selectedBatch; const previousLogoId = state.selectedLogoId;
  const zipFiles = []; const usedNames = new Set();
  for (let index = 0; index < state.batch.length; index += 1) {
    if (state.batch[index].review !== "approved") continue;
    $("batchMessage").classList.remove("error");
    $("batchMessage").textContent = `Gerando ${zipFiles.length + 1}/${counts.approved}…`;
    state.selectedBatch = index; await activateBatchLogo(state.batch[index]); await render(false);
    const item = state.batch[index];
    const folder = item.copySlug || safeName(templates[state.template].name);
    let name = `${folder}/${safeName(item.region || item.name)}--${state.format}`;
    if (usedNames.has(name)) { let copy = 2; while (usedNames.has(`${name}-${copy}`)) copy += 1; name = `${name}-${copy}`; }
    usedNames.add(name);
    zipFiles.push({ name:`${name}.png`, data:await canvasPngBytes() });
  }
  const stamp = new Date(); const pad = (value) => String(value).padStart(2,"0");
  const modelSlug = safeName(designFamilies[state.family]?.label || state.family);
  const zipName = `lote-${modelSlug}-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.zip`;
  const zipUrl = URL.createObjectURL(window.buildZip(zipFiles));
  download(zipUrl, zipName); setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
  state.selectedBatch = previous;
  if (previous >= 0 && state.batch[previous]) await activateBatchLogo(state.batch[previous]);
  else await activateBatchLogo({ logoId:previousLogoId });
  renderBatchList(); render();
  $("batchMessage").textContent = `Lote exportado: ${zipFiles.length} arquivos`;
}
