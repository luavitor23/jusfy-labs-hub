// Réguas, guias personalizadas, seleção de elementos e arrasto (posição, largura de texto, escala).
import { $, canvas, state, textKeys, protectedKeys, elementLabels, templates } from "./state.js";
import { currentLayout, createLayout, resolvedTextSpec } from "./catalog.js";
import { currentValues, fittedLines } from "./draw.js";
import { render, saveLocal } from "./render.js";
import { pushUndoSnapshot, commitChange } from "./history.js";

export function currentGuides() {
  if (!state.guides[state.template]) state.guides[state.template] = { v:[], h:[] };
  const guides = state.guides[state.template];
  if (!Array.isArray(guides.v)) guides.v = []; if (!Array.isArray(guides.h)) guides.h = [];
  return guides;
}

export function drawCustomGuides() {
  const guides = state.guides[state.template]; if (!guides) return;
  const ctx = canvas.getContext("2d");
  ctx.save(); ctx.strokeStyle = "rgba(64,87,255,.75)"; ctx.lineWidth = Math.max(1, 1 / (state.zoom || 1)); ctx.setLineDash([]);
  (guides.v || []).forEach((x) => { if (x >= 0 && x <= canvas.width) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } });
  (guides.h || []).forEach((y) => { if (y >= 0 && y <= canvas.height) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); } });
  ctx.restore();
}

const rulerBarSize = 22;

export function drawRulerBar(el, cssWidth, cssHeight, length, axis) {
  const dpr = window.devicePixelRatio || 1;
  el.width = Math.max(1, Math.round(cssWidth * dpr)); el.height = Math.max(1, Math.round(cssHeight * dpr));
  el.style.width = `${cssWidth}px`; el.style.height = `${cssHeight}px`;
  const bar = el.getContext("2d"); bar.setTransform(dpr, 0, 0, dpr, 0, 0);
  bar.clearRect(0, 0, cssWidth, cssHeight); bar.fillStyle = "#f6f8f7"; bar.fillRect(0, 0, cssWidth, cssHeight);
  bar.strokeStyle = "#b9c3bf"; bar.lineWidth = 1; bar.fillStyle = "#8a9490"; bar.font = "9px Poppins,Arial,sans-serif";
  let labelEvery = 100; while (labelEvery * state.zoom < 32) labelEvery *= 2;
  for (let value = 0; value <= length; value += 50) {
    const pos = Math.round(value * state.zoom) + .5; const major = value % labelEvery === 0;
    bar.beginPath();
    if (axis === "x") { bar.moveTo(pos, rulerBarSize); bar.lineTo(pos, rulerBarSize - (major ? 8 : 4)); }
    else { bar.moveTo(rulerBarSize, pos); bar.lineTo(rulerBarSize - (major ? 8 : 4), pos); }
    bar.stroke();
    if (major) {
      if (axis === "x") { bar.textAlign = "left"; bar.textBaseline = "top"; bar.fillText(String(value), pos + 2.5, 2); }
      else { bar.save(); bar.translate(8, pos - 2.5); bar.rotate(-Math.PI / 2); bar.textAlign = "left"; bar.textBaseline = "middle"; bar.fillText(String(value), 0, 0); bar.restore(); }
    }
  }
}

export function updateRulerBars() {
  const top = $("rulerTop"); const left = $("rulerLeft");
  top.hidden = !state.ruler; left.hidden = !state.ruler;
  $("clearGuidesButton").hidden = !state.ruler;
  $("canvasViewport").classList.toggle("has-rulers", state.ruler);
  if (!state.ruler) return;
  drawRulerBar(top, canvas.width * state.zoom, rulerBarSize, canvas.width, "x");
  drawRulerBar(left, rulerBarSize, canvas.height * state.zoom, canvas.height, "y");
}

export function snapGuideValue(raw) {
  const rounded = Math.round(raw / 10) * 10;
  return Math.abs(raw - rounded) <= 6 ? rounded : Math.round(raw);
}

export function guideNear(point) {
  if (!state.ruler) return null;
  const guides = state.guides[state.template]; if (!guides) return null;
  const tolerance = Math.max(6, 6 / (state.zoom || 1));
  const vIndex = (guides.v || []).findIndex((x) => Math.abs(point.x - x) <= tolerance);
  if (vIndex >= 0) return { axis:"v", index:vIndex };
  const hIndex = (guides.h || []).findIndex((y) => Math.abs(point.y - y) <= tolerance);
  if (hIndex >= 0) return { axis:"h", index:hIndex };
  return null;
}

export function showGuideLabel(axis, value, point) {
  const label = $("guideDragLabel"); label.hidden = false;
  label.textContent = axis === "h" ? `y: ${value}` : `x: ${value}`;
  label.style.left = `${Math.max(0, Math.min(canvas.width, point.x)) * state.zoom + 10}px`;
  label.style.top = `${Math.max(0, Math.min(canvas.height, point.y)) * state.zoom + 10}px`;
}

export function beginGuideFromRuler(event, axis) {
  if (!state.ruler || state.guideDrag) return;
  pushUndoSnapshot();
  const guides = currentGuides(); const point = canvasPoint(event);
  const list = axis === "h" ? guides.h : guides.v;
  list.push(snapGuideValue(axis === "h" ? point.y : point.x));
  state.guideDrag = { axis, index:list.length - 1, pointerId:event.pointerId };
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* eventos sintéticos */ }
  event.preventDefault();
  showGuideLabel(axis, list[list.length - 1], point); render();
}

export function moveGuideDrag(event) {
  if (!state.guideDrag || event.pointerId !== state.guideDrag.pointerId) return;
  const guides = currentGuides(); const point = canvasPoint(event);
  const list = state.guideDrag.axis === "h" ? guides.h : guides.v;
  list[state.guideDrag.index] = snapGuideValue(state.guideDrag.axis === "h" ? point.y : point.x);
  showGuideLabel(state.guideDrag.axis, list[state.guideDrag.index], point); render();
}

export function endGuideDrag(event) {
  if (!state.guideDrag || (event.pointerId !== undefined && event.pointerId !== state.guideDrag.pointerId)) return;
  const guides = currentGuides(); const { axis, index } = state.guideDrag;
  const list = axis === "h" ? guides.h : guides.v;
  const limit = axis === "h" ? canvas.height : canvas.width;
  if (list[index] < 0 || list[index] > limit) list.splice(index, 1);
  state.guideDrag = null; $("guideDragLabel").hidden = true; saveLocal(); commitChange(); render();
}

const widthHandleSize = 6;

export function widthHandlePoints() {
  if (state.multiSelection.size !== 1 || !state.selection || !textKeys.includes(state.selection)) return null;
  const area = state.hitAreas.find((item) => item.key === state.selection); if (!area) return null;
  const midY = area.y + area.height / 2;
  return { left:{ x:area.x - 7, y:midY }, right:{ x:area.x + area.width + 7, y:midY } };
}

export function cornerScaleHandlePoints() {
  if (state.multiSelection.size !== 1 || !state.selection || textKeys.includes(state.selection)) return null;
  const area = state.hitAreas.find((item) => item.key === state.selection); if (!area) return null;
  return {
    tl:{ x:area.x - 7, y:area.y - 7 }, tr:{ x:area.x + area.width + 7, y:area.y - 7 },
    bl:{ x:area.x - 7, y:area.y + area.height + 7 }, br:{ x:area.x + area.width + 7, y:area.y + area.height + 7 },
  };
}

export function drawSelection() {
  if (!state.multiSelection.size) return;
  const ctx = canvas.getContext("2d");
  state.multiSelection.forEach((key) => {
    const area = state.hitAreas.find((item) => item.key === key); if (!area) return;
    ctx.save(); ctx.strokeStyle = "#087fdd"; ctx.fillStyle = "#fff"; ctx.lineWidth = Math.max(2, 3 / state.zoom);
    ctx.setLineDash([10, 7]); ctx.strokeRect(area.x - 7, area.y - 7, area.width + 14, area.height + 14); ctx.setLineDash([]);
    ctx.restore();
  });
  if (state.multiSelection.size !== 1) return;
  const area = state.hitAreas.find((item) => item.key === state.selection); if (!area) return;
  ctx.save(); ctx.strokeStyle = "#087fdd"; ctx.fillStyle = "#fff"; ctx.lineWidth = Math.max(2, 3 / state.zoom);
  const corners = cornerScaleHandlePoints();
  [[area.x - 7,area.y - 7],[area.x + area.width + 7,area.y - 7],[area.x - 7,area.y + area.height + 7],[area.x + area.width + 7,area.y + area.height + 7]].forEach(([x,y]) => {
    if (corners) { ctx.fillRect(x - widthHandleSize,y - widthHandleSize,widthHandleSize * 2,widthHandleSize * 2); ctx.strokeRect(x - widthHandleSize,y - widthHandleSize,widthHandleSize * 2,widthHandleSize * 2); }
    else { ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
  });
  const handles = widthHandlePoints();
  if (handles) {
    [handles.left,handles.right].forEach(({x,y}) => { ctx.fillRect(x - widthHandleSize,y - widthHandleSize,widthHandleSize * 2,widthHandleSize * 2); ctx.strokeRect(x - widthHandleSize,y - widthHandleSize,widthHandleSize * 2,widthHandleSize * 2); });
  }
  ctx.restore();
}

export function selectElement(key) {
  state.selection = key;
  state.multiSelection = key ? new Set([key]) : new Set();
  updateSelectionUi(); render();
}

export function toggleElementSelection(key) {
  if (state.multiSelection.has(key)) {
    state.multiSelection.delete(key);
    if (state.selection === key) {
      const remaining = [...state.multiSelection];
      state.selection = remaining.length ? remaining[remaining.length - 1] : null;
    }
  } else {
    state.multiSelection.add(key);
    state.selection = key;
  }
  updateSelectionUi(); render();
}

export function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x:(event.clientX - rect.left) * canvas.width / rect.width, y:(event.clientY - rect.top) * canvas.height / rect.height };
}

export function selectedItem() { return state.selection && currentLayout()?.[state.selection]; }

export function adjustSelectedScale(delta) {
  const item = selectedItem(); if (!item) return;
  pushUndoSnapshot();
  const min = protectedKeys.includes(state.selection) ? .65 : .4; const max = protectedKeys.includes(state.selection) ? 1.35 : 2;
  item.scale = Math.min(max, Math.max(min, Math.round((item.scale + delta) * 100) / 100)); saveLocal(); render();
}

export function restoreSelected() {
  if (templates[state.template]?.type !== "mapped") return;
  const keys = state.multiSelection.size ? [...state.multiSelection] : (state.selection ? [state.selection] : []);
  if (!keys.length) return;
  pushUndoSnapshot();
  keys.forEach((key) => {
    const fresh = createLayout(state.template)[key]; if (!fresh) return;
    if (key === "logoGroup" && currentLayout().logoGroup?.mode) fresh.mode = currentLayout().logoGroup.mode;
    currentLayout()[key] = fresh;
  });
  saveLocal(); render();
}

export function fitZoom() {
  const viewport = $("canvasViewport"); const spec = templates[state.template];
  if (!viewport || !spec) return;
  const availableWidth = Math.max(200, viewport.clientWidth - 48); const availableHeight = Math.max(200, viewport.clientHeight - 48);
  state.zoom = Math.min(1, availableWidth / spec.width, availableHeight / spec.height);
  applyZoom("Ajustar");
}

export function applyZoom(label) {
  $("canvasWrap").style.width = `${canvas.width * state.zoom}px`; $("canvasWrap").style.height = `${canvas.height * state.zoom}px`;
  canvas.style.width = `${canvas.width * state.zoom}px`; canvas.style.height = `${canvas.height * state.zoom}px`;
  $("zoomLabel").textContent = label || `${Math.round(state.zoom * 100)}%`;
  updateRulerBars();
}

export function updateSelectionUi() {
  const mapped = templates[state.template]?.type === "mapped" && !(state.importedSources[state.template] && state.importMode === "original");
  const hasSelection = mapped && state.multiSelection.size > 0;
  $("selectionEmpty").hidden = hasSelection; $("selectionControls").hidden = !hasSelection;
  if (!hasSelection) return;
  if (state.multiSelection.size > 1) {
    const keys = [...state.multiSelection];
    $("selectedElementName").textContent = `${keys.length} elementos selecionados`;
    $("selectedElementPos").textContent = "Arraste um deles para mover o grupo junto.";
    $("fontControls").hidden = true;
    const hasDeletable = keys.some((key) => !protectedKeys.includes(key) && currentLayout()[key]?.visible);
    $("deleteElementButton").hidden = !hasDeletable;
    $("restoreElementButton").textContent = "Restaurar posição e tamanho do grupo";
    return;
  }
  const item = currentLayout()?.[state.selection];
  if (!item) return;
  $("fontControls").hidden = false;
  const freeElementSpec = templates[state.template]?.freeElements?.[state.selection];
  $("selectedElementName").textContent = elementLabels[state.selection] || freeElementSpec?.label || state.selection;
  const isText = textKeys.includes(state.selection);
  if (isText) {
    const widthSpec = resolvedTextSpec(state.selection, currentValues()[state.selection] || elementLabels[state.selection]);
    $("selectedElementPos").textContent = `x: ${Math.round(item.x)} · y: ${Math.round(item.y)} · largura: ${Math.round(widthSpec.width)}px`;
  } else {
    $("selectedElementPos").textContent = `x: ${Math.round(item.x)} · y: ${Math.round(item.y)}`;
  }
  $("sizeControlLabel").textContent = isText ? "Tamanho da fonte" : "Tamanho do componente";
  if (isText) { const value = currentValues()[state.selection] || elementLabels[state.selection]; $("fontSizeValue").textContent = `${Math.round(fittedLines(value,resolvedTextSpec(state.selection,value)).size)} px`; }
  else $("fontSizeValue").textContent = `${Math.round(item.scale * 100)}%`;
  $("deleteElementButton").hidden = protectedKeys.includes(state.selection) || !item.visible;
  $("restoreElementButton").textContent = item.visible ? "Restaurar posição e tamanho" : "Restaurar elemento";
}

const widthDragMin = 60; const widthDragMargin = 20;

export function moveWidthDrag(event) {
  const wd = state.widthDrag; if (!wd || (event.pointerId !== undefined && event.pointerId !== wd.pointerId)) return;
  const point = canvasPoint(event); const item = currentLayout()[wd.key];
  const maxWidth = Math.max(widthDragMin, canvas.width - widthDragMargin * 2);
  let width;
  if (wd.align === "left") {
    if (wd.side === "right") { width = point.x - item.x; }
    else { const rightEdge = wd.startItemX + wd.startWidth; width = rightEdge - point.x; }
    width = Math.max(widthDragMin, Math.min(maxWidth, width));
    if (wd.side === "left") item.x = wd.startItemX + wd.startWidth - width;
  } else {
    width = Math.max(widthDragMin, Math.min(maxWidth, Math.abs(point.x - item.x) * 2));
  }
  item.width = width; render();
}

export function moveScaleDrag(event) {
  const sd = state.scaleDrag; if (!sd || (event.pointerId !== undefined && event.pointerId !== sd.pointerId)) return;
  const point = canvasPoint(event);
  const dist = Math.hypot(point.x - sd.centerX, point.y - sd.centerY) || 1;
  const min = protectedKeys.includes(sd.key) ? .65 : .4; const max = protectedKeys.includes(sd.key) ? 1.35 : 2;
  const item = currentLayout()[sd.key];
  item.scale = Math.min(max, Math.max(min, Math.round(sd.startScale * (dist / sd.startDist) * 100) / 100));
  render();
}

export function finishDrag(event) {
  if (state.guideDrag) { endGuideDrag(event); return; }
  if (state.widthDrag) {
    if (event.pointerId !== undefined && event.pointerId !== state.widthDrag.pointerId) return;
    state.widthDrag = null; canvas.classList.remove("is-dragging"); saveLocal(); commitChange(); render(); return;
  }
  if (state.scaleDrag) {
    if (event.pointerId !== undefined && event.pointerId !== state.scaleDrag.pointerId) return;
    state.scaleDrag = null; canvas.classList.remove("is-dragging"); saveLocal(); commitChange(); render(); return;
  }
  if (!state.drag || (event.pointerId !== undefined && event.pointerId !== state.drag.pointerId)) return;
  state.drag = null; canvas.classList.remove("is-dragging"); saveLocal(); commitChange(); render();
}

export function syncRulerButton() { const button = $("rulerToggle"); button.classList.toggle("is-on", state.ruler); button.setAttribute("aria-pressed", String(state.ruler)); }
