// Orquestra o desenho do quadro (render), persistência local do rascunho e exportação SVG/PNG.
import { $, canvas, ctx, fields, state, templates, textKeys, elementLabels, commercialLayoutVersion, designFamilies, debounce } from "./state.js";
import { currentLayout, createLayout, resolvedTextSpec } from "./catalog.js";
import { parseSvg, escapeXml, safeName, download, distributeTextLines, loadImage } from "./svg-io.js";
import { currentValues, fittedLines, drawText, drawButtonBackground, drawCommercial, drawLogos, drawPriceRegionNote, updateOverflowWarnings, clearOverflowWarnings, logoGroupGeometry, drawFreeElements, ensureFreeElementCrop } from "./draw.js";
import { drawSelection, drawCustomGuides, updateSelectionUi } from "./interaction.js";
import { currentOfferAsset, regionalize, syncLogoModeUi } from "./assets-banks.js";
import { priceRegionNoteText } from "./state.js";

export function liveSvgText() {
  const doc = parseSvg(state.sourceText);
  [...doc.querySelectorAll("text")].forEach((node, index) => {
    const item = state.liveTextNodes[index]; if (!item) return; const tspans = [...node.querySelectorAll("tspan")];
    if (!tspans.length) { node.textContent = item.value; return; }
    const requested = item.value.split(/\r?\n/); const lines = requested.length === tspans.length ? requested : distributeTextLines(item.value,tspans.length);
    tspans.forEach((tspan,lineIndex) => { tspan.textContent = lines[lineIndex] || ""; });
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export async function render(showSelection = true) {
  if (!state.sourceImage) return;
  const spec = templates[state.template]; state.hitAreas = []; ctx.clearRect(0, 0, canvas.width, canvas.height);
  const importedOriginal = Boolean(state.importedSources[state.template] && state.importMode === "original");
  if (spec.type === "live" || (importedOriginal && state.liveTextNodes.length)) {
    try { state.sourceImage = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(liveSvgText())}`); } catch (error) { console.error(error); }
  }
  ctx.drawImage(state.sourceImage, 0, 0, spec.width, spec.height);
  if (spec.type === "mapped" && !importedOriginal) {
    spec.patches.forEach(([x,y,w,h,color]) => { ctx.fillStyle = color || "#fafafa"; ctx.fillRect(x,y,w,h); });
    const values = currentValues(); const layout = currentLayout();
    textKeys.forEach((key) => {
      if (!layout[key].visible) return;
      const value = values[key] || elementLabels[key]; const textSpec = resolvedTextSpec(key,value); const item = layout[key];
      if (textSpec.button) drawButtonBackground(item, textSpec.button);
      const area = drawText(value, textSpec, key);
      if (textSpec.button) { area.x = item.x + textSpec.button.dx; area.y = item.y + textSpec.button.dy; area.width = textSpec.button.width; area.height = textSpec.button.height; }
    });
    drawCommercial(spec.commercial); drawLogos(spec.logos); drawPriceRegionNote(spec); drawFreeElements(spec);
    updateOverflowWarnings(values, layout);
    if (showSelection) drawSelection();
  } else {
    clearOverflowWarnings();
  }
  if (showSelection && state.ruler) drawCustomGuides();
  updateSelectionUi(); syncLogoModeUi();
  $("loadingState").classList.add("is-hidden"); $("saveState").textContent = "Alterações locais salvas automaticamente";
}

export const scheduleRender = debounce(() => { saveLocal(); render(); }, 120);

export function updateCounters() {
  const limits = { category:40, headline:120, support:180, cta:80 };
  Object.entries(fields).forEach(([key, field]) => { $(`${key}Count`).textContent = `${field.value.length}/${limits[key]}`; });
}

export function captureFamilyFields() { state.familyFields[state.family] = Object.fromEntries(Object.entries(fields).map(([key,field]) => [key,field.value])); }

export function saveLocal() {
  captureFamilyFields(); const data = { fields:Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])), familyFields:state.familyFields, family:state.family, format:state.format, layouts:state.layouts, guides:state.guides, selectedLogoId:state.selectedLogoId, commercialLayoutVersion };
  localStorage.setItem("jusfy-creative-draft", JSON.stringify(data)); $("saveState").textContent = "Salvando…";
}

export function restoreLocal() {
  try {
    const data = JSON.parse(localStorage.getItem("jusfy-creative-draft")); if (!data) return;
    const savedFields = data.fields || data;
    if (data.familyFields) state.familyFields = data.familyFields;
    if (data.family && designFamilies[data.family]) state.family = data.family;
    if (["square","story"].includes(data.format)) state.format = data.format;
    Object.entries(fields).forEach(([key, field]) => { if (Object.hasOwn(savedFields,key)) field.value = savedFields[key]; });
    if (data.layouts) state.layouts = data.layouts;
    if (data.guides && typeof data.guides === "object") state.guides = data.guides;
    if (data.commercialLayoutVersion !== commercialLayoutVersion) Object.keys(templates).forEach((key) => { if (state.layouts[key]) state.layouts[key].commercialBlock = createLayout(key).commercialBlock; });
    if (data.selectedLogoId) state.selectedLogoId = data.selectedLogoId;
  } catch (_) { /* rascunho opcional */ }
}

export function commercialSvg(spec, item) {
  const transform = `translate(${item.x} ${item.y}) scale(${item.scale}) translate(${-spec.centerX} ${-spec.centerY})`;
  const [bx,by,bw,bh] = spec.bounds;
  const asset = currentOfferAsset();
  let imageSvg = "";
  if (asset?.image) {
    const scale = Math.min(bw / asset.image.naturalWidth, bh / asset.image.naturalHeight);
    const width = asset.image.naturalWidth * scale; const height = asset.image.naturalHeight * scale;
    const x = bx + bw / 2 - width / 2; const y = by + bh / 2 - height / 2;
    imageSvg = `<image href="${escapeXml(asset.url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<g transform="${transform}">${imageSvg}</g>`;
}

export function overlaySvg(spec, values) {
  const base = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(state.sourceText)))}`;
  const textBlock = (value, textSpec) => {
    ctx.font = `${textSpec.weight} ${textSpec.maxSize}px Poppins`; const fitted = fittedLines(value, textSpec); const lineHeight = fitted.size * textSpec.lineHeight;
    return fitted.lines.map((line, index) => `<text x="${textSpec.x}" y="${textSpec.y + index * lineHeight}" text-anchor="${textSpec.align === "left" ? "start" : "middle"}" dominant-baseline="hanging" fill="${textSpec.color}" opacity="${textSpec.opacity ?? 1}" font-family="Poppins,Arial,sans-serif" font-size="${fitted.size}" font-weight="${textSpec.weight}">${escapeXml(line)}</text>`).join("");
  };
  const patches = spec.patches.map(([x,y,w,h,color]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color || "#fafafa"}"/>`).join("");
  const layout = currentLayout();
  let logoSvg = ""; let separatorSvg = "";
  const groupItem = layout.logoGroup;
  if (groupItem && groupItem.visible) {
    const geo = logoGroupGeometry(spec.logos, groupItem);
    if (geo) {
      const logoImage = (rect, url) => rect && url ? `<image href="${escapeXml(url)}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" preserveAspectRatio="xMidYMid meet"/>` : "";
      logoSvg = logoImage(geo.regional, state.logoUrls.regional) + logoImage(geo.jusfy, state.logoUrls.jusfy);
      if (geo.plus) separatorSvg = `<text x="${geo.plus.x}" y="${geo.plus.y}" text-anchor="middle" dominant-baseline="middle" fill="#d6d9d8" font-family="Poppins,Arial,sans-serif" font-size="${geo.plus.size}" font-weight="500">+</text>`;
    }
  }
  const protectedSvg = spec.commercial && layout.commercialBlock ? commercialSvg(spec.commercial, layout.commercialBlock) : "";
  const freeElementsSvg = Object.entries(spec.freeElements || {}).map(([key, elementSpec]) => {
    const item = layout[key]; if (!item || !item.visible) return "";
    const [bx,by,bw,bh] = elementSpec.bounds;
    const crop = ensureFreeElementCrop(key, elementSpec);
    const dataUrl = crop.canvas.toDataURL("image/png");
    const transform = `translate(${item.x} ${item.y}) scale(${item.scale}) translate(${-(bx + bw / 2)} ${-(by + bh / 2)})`;
    return `<g transform="${transform}"><image href="${escapeXml(dataUrl)}" x="${bx}" y="${by}" width="${bw}" height="${bh}" preserveAspectRatio="xMidYMid meet"/></g>`;
  }).join("");
  const buttonSvg = textKeys.map((key) => {
    if (!layout[key].visible) return ""; const value = values[key] || elementLabels[key]; const textSpec = resolvedTextSpec(key,value); const item = layout[key];
    if (!textSpec.button) return "";
    const bx = item.x + textSpec.button.dx; const by = item.y + textSpec.button.dy;
    return `<rect x="${bx}" y="${by}" width="${textSpec.button.width}" height="${textSpec.button.height}" rx="${textSpec.button.radius}" fill="${textSpec.button.color}"/>`;
  }).join("");
  const editableText = textKeys.map((key) => { const value = values[key] || elementLabels[key]; return layout[key].visible ? textBlock(value, resolvedTextSpec(key,value)) : ""; }).join("");
  const priceRegionNoteItem = layout.priceRegionNote;
  const priceRegionNoteSvg = spec.priceRegionNote && priceRegionNoteItem?.visible
    ? textBlock(regionalize(priceRegionNoteText), { ...spec.priceRegionNote, x:priceRegionNoteItem.x, y:priceRegionNoteItem.y, maxSize:spec.priceRegionNote.maxSize * priceRegionNoteItem.scale, minSize:spec.priceRegionNote.minSize * priceRegionNoteItem.scale })
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}"><image href="${base}" width="${spec.width}" height="${spec.height}"/>${patches}${buttonSvg}${editableText}${priceRegionNoteSvg}${protectedSvg}${logoSvg}${separatorSvg}${freeElementsSvg}</svg>`;
}

export function exportSvg() {
  const spec = templates[state.template]; let text;
  const importedOriginal = Boolean(state.importedSources[state.template] && state.importMode === "original");
  if (spec.type === "live" || (importedOriginal && state.liveTextNodes.length)) text = liveSvgText();
  else if (spec.type === "mapped" && !importedOriginal) text = overlaySvg(spec, currentValues());
  else text = state.sourceText;
  const blob = new Blob([text], { type:"image/svg+xml;charset=utf-8" }); const url = URL.createObjectURL(blob);
  download(url, `${safeName(currentValues().name || spec.name)}.svg`); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPng(name) {
  await render(false); download(canvas.toDataURL("image/png"), `${safeName(name || currentValues().name || templates[state.template].name)}.png`); render();
}
