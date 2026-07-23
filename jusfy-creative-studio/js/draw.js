// Primitivas de desenho no canvas: texto ajustado, bloco comercial e composto de logos.
import { ctx, fields, state, textKeys, priceRegionNoteText } from "./state.js";
import { currentLayout, resolvedTextSpec } from "./catalog.js";
import { currentOfferAsset, regionalize } from "./assets-banks.js";

export function currentValues() {
  if (state.selectedBatch >= 0 && state.batch[state.selectedBatch]) return state.batch[state.selectedBatch];
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
}

export function wrapLines(text, maxWidth) {
  const words = String(text).trim().split(/\s+/).filter(Boolean); const lines = []; let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line); return lines;
}

export function fontString(spec, size) { return `${spec.italic ? "italic " : ""}${spec.weight} ${size}px Poppins, Arial, sans-serif`; }

export function fittedLines(text, spec) {
  let size = spec.maxSize; let lines = [];
  while (size >= spec.minSize) {
    ctx.font = fontString(spec, size); lines = wrapLines(text, spec.width);
    if (lines.length <= spec.maxLines && lines.length * size * spec.lineHeight <= spec.height) break;
    size -= 1;
  }
  if (lines.length > spec.maxLines) {
    lines = lines.slice(0, spec.maxLines); const last = lines.length - 1;
    while (ctx.measureText(`${lines[last]}…`).width > spec.width && lines[last].includes(" ")) lines[last] = lines[last].split(" ").slice(0, -1).join(" ");
    lines[last] += "…";
  }
  return { lines, size };
}

export function roundedRectPath(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawButtonBackground(item, button) {
  const x = item.x + button.dx; const y = item.y + button.dy;
  ctx.save(); ctx.fillStyle = button.color; roundedRectPath(x, y, button.width, button.height, button.radius); ctx.fill(); ctx.restore();
}

export function drawText(text, spec, key) {
  const result = fittedLines(text, spec); const lineHeight = result.size * spec.lineHeight;
  ctx.save(); ctx.fillStyle = spec.color; ctx.font = fontString(spec, result.size);
  const align = spec.align || "center"; ctx.textAlign = align; ctx.textBaseline = "top";
  result.lines.forEach((line, index) => ctx.fillText(line, spec.x, spec.y + index * lineHeight)); ctx.restore();
  let areaX = spec.x - spec.width / 2;
  if (align === "left") areaX = spec.x; else if (align === "right") areaX = spec.x - spec.width;
  const area = { key, x:areaX, y:spec.y, width:spec.width, height:Math.max(lineHeight, result.lines.length * lineHeight) };
  state.hitAreas.push(area); return area;
}

export function drawPriceRegionNote(spec) {
  const noteSpec = spec.priceRegionNote; if (!noteSpec) return;
  const text = regionalize(priceRegionNoteText);
  const result = fittedLines(text, noteSpec); const lineHeight = result.size * noteSpec.lineHeight;
  ctx.save(); ctx.globalAlpha = noteSpec.opacity ?? 1; ctx.fillStyle = noteSpec.color;
  ctx.font = `${noteSpec.weight} ${result.size}px Poppins, Arial, sans-serif`;
  ctx.textAlign = noteSpec.align || "left"; ctx.textBaseline = "top";
  result.lines.forEach((line, index) => ctx.fillText(line, noteSpec.x, noteSpec.y + index * lineHeight));
  ctx.restore();
}

export function textOverflows(text, spec) {
  const previousFont = ctx.font; let size = spec.maxSize; let overflows = true;
  while (size >= spec.minSize) {
    ctx.font = fontString(spec, size);
    const lines = wrapLines(text, spec.width);
    const fitsBox = lines.length <= spec.maxLines && lines.length * size * spec.lineHeight <= spec.height;
    const fitsWidth = lines.every((line) => ctx.measureText(line).width <= spec.width + 1);
    if (fitsBox && fitsWidth) { overflows = false; break; }
    size -= 1;
  }
  ctx.font = previousFont; return overflows;
}

const overflowWarningText = "O texto pode estar ultrapassando a área no criativo. Revise a prévia.";

export function setFieldOverflow(key, overflows) {
  const wrap = fields[key]?.closest(".field"); if (!wrap) return;
  wrap.classList.toggle("is-overflowing", overflows);
  const note = wrap.querySelector(".overflow-warning");
  if (overflows && !note) { const warning = document.createElement("small"); warning.className = "overflow-warning"; warning.textContent = overflowWarningText; wrap.append(warning); }
  if (!overflows && note) note.remove();
}

export function updateOverflowWarnings(values, layout) {
  if (state.selectedBatch >= 0) { clearOverflowWarnings(); return; }
  textKeys.forEach((key) => {
    const value = values[key];
    const overflows = Boolean(value) && Boolean(layout[key]?.visible) && textOverflows(value, resolvedTextSpec(key, value));
    setFieldOverflow(key, overflows);
  });
}

export function clearOverflowWarnings() {
  textKeys.forEach((key) => setFieldOverflow(key, false));
}

export function drawContain(image, cx, cy, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
  ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height); return { width, height };
}

export function drawCommercial(spec) {
  if (!spec) return;
  const item = currentLayout().commercialBlock;
  const [bx,by,bw,bh] = spec.bounds;
  const asset = currentOfferAsset();
  ctx.save(); ctx.translate(item.x, item.y); ctx.scale(item.scale, item.scale); ctx.translate(-spec.centerX, -spec.centerY);
  if (asset?.image) drawContain(asset.image, bx + bw / 2, by + bh / 2, bw, bh);
  ctx.restore();
  state.hitAreas.push({ key:"commercialBlock", x:item.x + (bx - spec.centerX) * item.scale, y:item.y + (by - spec.centerY) * item.scale, width:bw * item.scale, height:bh * item.scale });
}

export function logoGroupCenterX(spec, item, renderedWidth) {
  const anchor = spec.anchor || "center";
  if (anchor === "left") return item.x + renderedWidth / 2;
  if (anchor === "right") return item.x - renderedWidth / 2;
  return item.x;
}

export function logoGroupGeometry(spec, item) {
  const mode = item.mode === "jusfy" ? "jusfy" : "cobrand";
  const jusfyImage = state.logos.jusfy;
  if (mode === "jusfy") {
    if (!jusfyImage) return null;
    const scale = Math.min(spec.maxWidth / jusfyImage.naturalWidth, spec.maxHeight / jusfyImage.naturalHeight) * item.scale;
    const width = jusfyImage.naturalWidth * scale; const height = jusfyImage.naturalHeight * scale;
    const centerX = logoGroupCenterX(spec, item, width);
    const rect = { x:centerX - width / 2, y:item.y - height / 2, width, height };
    return { mode, jusfy:rect, regional:null, plus:null, bounds:{ ...rect } };
  }
  const regionalImage = state.logos.regional;
  if (state.regionalIsLockup && regionalImage) {
    const scale = Math.min(spec.maxWidth / regionalImage.naturalWidth, spec.maxHeight / regionalImage.naturalHeight) * item.scale;
    const width = regionalImage.naturalWidth * scale; const height = regionalImage.naturalHeight * scale;
    const centerX = logoGroupCenterX(spec, item, width);
    const rect = { x:centerX - width / 2, y:item.y - height / 2, width, height };
    return { mode, regional:rect, jusfy:null, plus:null, bounds:{ ...rect } };
  }
  const fit = (image) => image ? { width:image.naturalWidth * (spec.maxHeight / image.naturalHeight), height:spec.maxHeight } : null;
  const sizes = { regional:fit(regionalImage), jusfy:fit(jusfyImage) };
  if (!sizes.regional && !sizes.jusfy) return null;
  const gap = sizes.regional && sizes.jusfy ? spec.gap : 0;
  const total = (sizes.regional ? sizes.regional.width : 0) + (sizes.jusfy ? sizes.jusfy.width : 0) + gap;
  const factor = (total > spec.maxWidth ? spec.maxWidth / total : 1) * item.scale;
  const order = (spec.reverse ? ["jusfy", "regional"] : ["regional", "jusfy"]).filter((key) => sizes[key]);
  const groupWidth = total * factor; const groupHeight = spec.maxHeight * factor;
  const centerX = logoGroupCenterX(spec, item, groupWidth);
  let cursor = centerX - groupWidth / 2; const rects = { regional:null, jusfy:null }; let plus = null;
  order.forEach((key, index) => {
    const width = sizes[key].width * factor; const height = sizes[key].height * factor;
    rects[key] = { x:cursor, y:item.y - height / 2, width, height };
    cursor += width;
    if (index === 0 && order.length === 2) { plus = { x:cursor + gap * factor / 2, y:item.y, size:Math.round(spec.maxHeight * .38 * factor) }; cursor += gap * factor; }
  });
  return { mode, regional:rects.regional, jusfy:rects.jusfy, plus, bounds:{ x:centerX - groupWidth / 2, y:item.y - groupHeight / 2, width:groupWidth, height:groupHeight } };
}

export function drawLogos(spec) {
  const layout = currentLayout(); const item = layout.logoGroup;
  if (!item || !item.visible) return;
  const geo = logoGroupGeometry(spec, item); if (!geo) return;
  if (geo.regional) ctx.drawImage(state.logos.regional, geo.regional.x, geo.regional.y, geo.regional.width, geo.regional.height);
  if (geo.jusfy) ctx.drawImage(state.logos.jusfy, geo.jusfy.x, geo.jusfy.y, geo.jusfy.width, geo.jusfy.height);
  if (geo.plus) {
    ctx.save(); ctx.fillStyle = "#d6d9d8"; ctx.font = `500 ${geo.plus.size}px Poppins,Arial,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", geo.plus.x, geo.plus.y); ctx.restore();
  }
  state.hitAreas.push({ key:"logoGroup", x:geo.bounds.x, y:geo.bounds.y, width:geo.bounds.width, height:geo.bounds.height });
}

// Recorte da arte original de um "elemento livre" (selo, estrela, etc.) — permite mover/redimensionar
// pedaços decorativos fixos do SVG sem precisar de um banco de imagens por elemento.
export function ensureFreeElementCrop(key, elementSpec) {
  const cacheKey = `${state.template}:${key}`;
  const cached = state.freeElementCrops[cacheKey];
  if (cached) return cached;
  const [bx, by, bw, bh] = elementSpec.bounds;
  const oversample = 2;
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round(bw * oversample));
  cropCanvas.height = Math.max(1, Math.round(bh * oversample));
  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.drawImage(state.sourceImage, bx, by, bw, bh, 0, 0, cropCanvas.width, cropCanvas.height);
  const entry = { canvas: cropCanvas };
  state.freeElementCrops[cacheKey] = entry;
  return entry;
}

export function drawFreeElements(spec) {
  const layout = currentLayout();
  Object.entries(spec.freeElements || {}).forEach(([key, elementSpec]) => {
    const item = layout[key];
    if (!item || !item.visible) return;
    const [bx, by, bw, bh] = elementSpec.bounds;
    const crop = ensureFreeElementCrop(key, elementSpec);
    ctx.save(); ctx.translate(item.x, item.y); ctx.scale(item.scale, item.scale); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
    ctx.drawImage(crop.canvas, bx, by, bw, bh);
    ctx.restore();
    state.hitAreas.push({ key, x:item.x - (bw / 2) * item.scale, y:item.y - (bh / 2) * item.scale, width:bw * item.scale, height:bh * item.scale });
  });
}
