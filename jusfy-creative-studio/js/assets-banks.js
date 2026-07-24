// Banco de logos, banco de ofertas comerciais e regras de regionalização (troca de OAB/UF).
import { $, state, fields, templates } from "./state.js";
import { fetchAsDataUrl, loadImage, readFile } from "./svg-io.js";
import { currentLayout, familyCobranding } from "./catalog.js";
import { render, saveLocal, updateCounters } from "./render.js";
import { showError } from "./errors.js";

export function currentOfferAsset() {
  const id = currentLayout()?.commercialOffer;
  return id ? state.offerAssets[id] : null;
}

async function offerAssetDataUrl(item) {
  if (item.dataUrl) return item.dataUrl;
  item.dataUrl = await fetchAsDataUrl(item.source);
  return item.dataUrl;
}

export async function ensureOfferLoaded(id) {
  if (!id) return null;
  if (state.offerAssets[id]) return state.offerAssets[id];
  const item = state.offerCatalog.find((candidate) => candidate.id === id);
  if (!item) return null;
  const url = await offerAssetDataUrl(item);
  const image = await loadImage(url);
  state.offerAssets[id] = { url, image };
  return state.offerAssets[id];
}

export async function ensureCurrentOfferLoaded() {
  const spec = templates[state.template];
  if (!spec?.commercial) return;
  await ensureOfferLoaded(currentLayout()?.commercialOffer);
}

export async function selectOffer(item, shouldRender = true) {
  await ensureOfferLoaded(item.id);
  const layout = currentLayout(); if (!layout) return;
  layout.commercialOffer = item.id; saveLocal(); renderOfferBank(); if (shouldRender) render();
}

export function renderOfferBank() {
  const host = $("offerBank"); if (!host) return; host.replaceChildren();
  const activeId = currentLayout()?.commercialOffer;
  state.offerCatalog.forEach((item) => {
    const card = document.createElement("article"); card.className = `logo-bank-item${item.id === activeId ? " is-active" : ""}`;
    const button = document.createElement("button"); button.type = "button"; button.className = "logo-bank-main"; button.setAttribute("aria-label", `Usar ${item.name}`);
    const preview = document.createElement("span"); const name = document.createElement("small"); name.textContent = item.name;
    button.append(preview,name); button.addEventListener("click", () => selectOffer(item).catch(showError)); card.append(button);
    host.append(card);
    offerAssetDataUrl(item).then((url) => { const image = document.createElement("img"); image.src = url; image.alt = ""; preview.append(image); }).catch(() => { preview.textContent = "!"; });
  });
  $("offerBankStatus").textContent = `${state.offerCatalog.length} oferta(s) disponível(is)`;
}

export async function loadOfferCatalog() {
  const response = await fetch("/api/ofertas"); if (!response.ok) throw new Error("Não foi possível carregar o banco de ofertas.");
  const payload = await response.json(); state.offerCatalog = payload.items || []; renderOfferBank();
}

export function updateOfferSectionUi() {
  $("offerBankSection").hidden = !templates[state.template]?.commercial;
}

export function renderLogoBank() {
  const host = $("logoBank"); host.replaceChildren();
  state.logoCatalog.forEach((item) => {
    const card = document.createElement("article"); card.dataset.logoId = item.id; card.className = `logo-bank-item${item.id === state.selectedLogoId ? " is-active" : ""}`;
    const button = document.createElement("button"); button.type = "button"; button.className = "logo-bank-main"; button.setAttribute("aria-label", `Usar ${item.name}`);
    const preview = document.createElement("span"); const name = document.createElement("small"); name.textContent = item.name;
    button.append(preview,name); button.addEventListener("click", () => selectCatalogLogo(item).catch(showError)); card.append(button);
    if (item.sourceKind === "file-svg") { card.title = `SVG individual: banco-logos/${item.id}.svg`; const dot = document.createElement("i"); dot.className = "logo-file-dot"; card.append(dot); }
    if (item.target === "regional") {
      const check = document.createElement("input"); check.type = "checkbox"; check.className = "logo-bank-check"; check.dataset.logoSelect = item.id;
      check.checked = state.logoSelection.has(item.id); check.setAttribute("aria-label", `Incluir ${item.name} nas variações`);
      check.addEventListener("change", () => { if (check.checked) state.logoSelection.add(item.id); else state.logoSelection.delete(item.id); renderLogoBank(); }); card.append(check);
    }
    host.append(card);
    catalogAssetDataUrl(item, 1).then((url) => { const image = document.createElement("img"); image.src = url; image.alt = ""; preview.append(image); }).catch(() => { preview.textContent = "!"; });
  });
  const regionals = state.logoCatalog.filter((item) => item.target === "regional");
  $("logoBankStatus").textContent = `${regionals.length} regionais · ${state.logoSelection.size} selecionada(s)`;
  $("selectVisibleLogosButton").textContent = regionals.length && regionals.every((item) => state.logoSelection.has(item.id)) ? "Limpar seleção" : "Selecionar regionais";
}

export async function selectCatalogLogo(item, shouldRender = true) {
  const kind = item.target === "jusfy" ? "jusfy" : "regional"; const url = await catalogAssetDataUrl(item);
  state.logoUrls[kind] = url; state.logos[kind] = await loadImage(url);
  if (kind === "regional") {
    state.selectedLogoId = item.id; state.selectedRegion = item.region || state.selectedRegion; state.regionalIsLockup = item.sourceKind === "file-svg";
    [fields.headline,fields.support,fields.cta].forEach((field) => { field.value = regionalize(field.value); }); updateCounters();
  }
  if (currentLayout()?.logoGroup) currentLayout().logoGroup.visible = true;
  $(`${kind}LogoName`).textContent = item.name; saveLocal(); renderLogoBank(); if (shouldRender) render();
}

export async function loadLogoCatalog() {
  const response = await fetch("/api/logos"); if (!response.ok) throw new Error("Não foi possível carregar o banco de logos.");
  const payload = await response.json(); state.logoCatalog = payload.items || []; renderLogoBank();
  const selected = state.logoCatalog.find((item) => item.id === state.selectedLogoId) || state.logoCatalog.find((item) => item.id === "caasp");
  const jusfy = state.logoCatalog.find((item) => item.target === "jusfy");
  if (jusfy) await selectCatalogLogo(jusfy, false); if (selected) await selectCatalogLogo(selected, false);
}

export function regionalize(value) {
  return regionalizeFor(value, state.selectedRegion || "OAB/SP");
}

function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function regionalizeFor(value, region) {
  let text = String(value || "").replace(/OAB\/(?:UF|[A-Z]{2})/g, region || "OAB/SP");
  const targetUf = (/^OAB\/([A-Z]{2})$/.exec(region || "") || [])[1];
  if (targetUf) {
    const ufs = [...new Set(state.logoCatalog.map((item) => ((/^OAB\/([A-Z]{2})$/.exec(item.region || "") || [])[1])).filter(Boolean))];
    if (ufs.length) text = text.replace(new RegExp(`(?<![\\p{L}/])(?:${ufs.join("|")})(?!\\p{L})`, "gu"), targetUf);
    const targetStateName = state.logoCatalog.find((item) => item.region === region)?.stateName;
    const stateNames = [...new Set(state.logoCatalog.map((item) => item.stateName).filter(Boolean))];
    if (targetStateName && stateNames.length) {
      const pattern = stateNames.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|");
      text = text.replace(new RegExp(`(?<!\\p{L})(?:${pattern})(?!\\p{L})`, "gu"), targetStateName);
    }
  }
  return text;
}

export async function catalogAssetDataUrl(item, scale = 3) {
  const cacheKey = scale === 1 ? "previewDataUrl" : "dataUrl"; if (item[cacheKey]) return item[cacheKey];
  if (!item.crop) {
    item.dataUrl = item.dataUrl || await fetchAsDataUrl(item.source); item.previewDataUrl = item.dataUrl; return item[cacheKey];
  }
  item.sourceImage = item.sourceImage || await loadImage(item.source); const [x,y,width,height] = item.crop;
  const cropCanvas = document.createElement("canvas"); cropCanvas.width = Math.round(width * scale); cropCanvas.height = Math.round(height * scale);
  const cropContext = cropCanvas.getContext("2d");
  cropContext.drawImage(item.sourceImage,x,y,width,height,0,0,cropCanvas.width,cropCanvas.height);
  removeNeutralLightBackground(cropContext, cropCanvas.width, cropCanvas.height);
  item[cacheKey] = cropCanvas.toDataURL("image/png"); return item[cacheKey];
}

function removeNeutralLightBackground(context, width, height) {
  const image = context.getImageData(0,0,width,height); const pixels = image.data; const visited = new Uint8Array(width * height); const queue = new Int32Array(width * height); let head = 0; let tail = 0;
  const isLightNeutral = (pixel) => { const offset = pixel * 4; const lightest = Math.max(pixels[offset],pixels[offset + 1],pixels[offset + 2]); const darkest = Math.min(pixels[offset],pixels[offset + 1],pixels[offset + 2]); return darkest > 225 && lightest - darkest < 16; };
  const enqueue = (pixel) => { if (pixel < 0 || pixel >= visited.length || visited[pixel] || !isLightNeutral(pixel)) return; visited[pixel] = 1; queue[tail++] = pixel; };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++]; const x = pixel % width; const y = Math.floor(pixel / width); const offset = pixel * 4; const darkest = Math.min(pixels[offset],pixels[offset + 1],pixels[offset + 2]);
    pixels[offset + 3] = darkest >= 248 ? 0 : Math.round(pixels[offset + 3] * (248 - darkest) / 23);
    if (x > 0) enqueue(pixel - 1); if (x + 1 < width) enqueue(pixel + 1); if (y > 0) enqueue(pixel - width); if (y + 1 < height) enqueue(pixel + width);
  }
  context.putImageData(image,0,0);
}

export function selectedRegionalLogos(useActiveFallback = true) {
  const selected = state.logoCatalog.filter((item) => item.target === "regional" && state.logoSelection.has(item.id));
  if (selected.length || !useActiveFallback) return selected;
  const active = state.logoCatalog.find((item) => item.id === state.selectedLogoId && item.target === "regional"); return active ? [active] : [];
}

export function toggleVisibleLogoSelection() {
  const items = state.logoCatalog.filter((item) => item.target === "regional"); const allSelected = items.length && items.every((item) => state.logoSelection.has(item.id));
  items.forEach((item) => { if (allSelected) state.logoSelection.delete(item.id); else state.logoSelection.add(item.id); }); renderLogoBank();
}

export function updateCobrandingUi() {
  const noCobrand = !familyCobranding();
  ["logoModeControls","regionalLogoUpload","logoBankHeading","logoBank","logoBankActions"].forEach((id) => { $(id).hidden = noCobrand; });
  $("cobrandingNotice").hidden = !noCobrand;
}

export function syncLogoModeUi() {
  const mode = currentLayout()?.logoGroup?.mode === "jusfy" ? "jusfy" : "cobrand";
  $("cobrandModeButton").classList.toggle("is-active", mode === "cobrand");
  $("jusfyOnlyModeButton").classList.toggle("is-active", mode === "jusfy");
}

export function setLogoMode(mode) {
  const layout = currentLayout(); if (!layout?.logoGroup) return;
  layout.logoGroup.mode = mode; layout.logoGroup.visible = true;
  syncLogoModeUi(); saveLocal(); render();
}

export function ensureCobrandForRegionals() {
  if (!familyCobranding()) return "";
  const layout = currentLayout();
  if (!layout?.logoGroup || layout.logoGroup.mode !== "jusfy") return "";
  layout.logoGroup.mode = "cobrand"; layout.logoGroup.visible = true; syncLogoModeUi(); saveLocal();
  return " Modo co-brand reativado para gerar por regionais.";
}

export async function handleLogo(kind, file) {
  if (!file) return; const url = await readFile(file, "data"); state.logoUrls[kind] = url; state.logos[kind] = await loadImage(url);
  if (currentLayout()?.logoGroup) currentLayout().logoGroup.visible = true;
  if (kind === "regional") { state.selectedLogoId = ""; state.regionalIsLockup = false; } $(`${kind}LogoName`).textContent = file.name; saveLocal(); renderLogoBank(); render();
}
