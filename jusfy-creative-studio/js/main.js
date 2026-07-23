// Bootstrap do Studio: liga todos os eventos de UI e inicia o carregamento do catálogo.
import { $, canvas, state, fields, defaults, familyFieldDefaults, templates, protectedKeys, elementLabels, debounce } from "./state.js";
import { loadTemplateCatalog, renderFamilySelect, templateKeyFor, updateCopyFieldsNotice, resolvedTextSpec } from "./catalog.js";
import { fetchAsDataUrl, loadImage } from "./svg-io.js";
import { render, saveLocal, restoreLocal, updateCounters, exportSvg, exportPng, scheduleRender } from "./render.js";
import {
  selectFamily, selectFormat, handleTemplateImport, setImportMode, loadTemplate, applyFamilyFields,
} from "./template-loader.js";
import {
  setLogoMode, handleLogo, selectCatalogLogo, loadLogoCatalog, loadOfferCatalog,
  toggleVisibleLogoSelection,
} from "./assets-banks.js";
import { loadNotionCopies, renderCopyLibrary, toggleVisibleCopySelection } from "./copies.js";
import { generateLogoVariations, generateNotionVariations, activateBatchLogo, renderBatchList, generateBatchThumbs, exportApprovedBatch } from "./batch.js";
import { saveApprovedMaster, loadMasters } from "./masters.js";
import { currentValues } from "./draw.js";
import { currentLayout } from "./catalog.js";
import {
  adjustSelectedScale, restoreSelected, syncRulerButton, updateRulerBars, fitZoom, applyZoom,
  canvasPoint, widthHandlePoints, cornerScaleHandlePoints, guideNear, moveGuideDrag, endGuideDrag,
  beginGuideFromRuler, moveWidthDrag, moveScaleDrag, finishDrag, selectElement, toggleElementSelection,
  setSelectedAlign, toggleSelectedBold, toggleSelectedItalic,
} from "./interaction.js";
import { showError } from "./errors.js";
import { pushUndoSnapshot, beginChange, undo, redo } from "./history.js";

Object.values(fields).forEach((field) => field.addEventListener("input", () => { state.selectedBatch = -1; updateCounters(); scheduleRender(); }));

$("familySelect").addEventListener("change", (event) => selectFamily(event.target.value).catch(showError));
document.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => selectFormat(button.dataset.format).catch(showError)));
$("squareSvgInput").addEventListener("change", (event) => handleTemplateImport(templateKeyFor(state.family,"square"), event.target.files[0]));
$("storySvgInput").addEventListener("change", (event) => handleTemplateImport(templateKeyFor(state.family,"story"), event.target.files[0]));
$("originalModeButton").addEventListener("click", () => setImportMode("original"));
$("mappedModeButton").addEventListener("click", () => setImportMode("mapped"));
$("cobrandModeButton").addEventListener("click", () => setLogoMode("cobrand"));
$("jusfyOnlyModeButton").addEventListener("click", () => setLogoMode("jusfy"));
$("regionalLogoInput").addEventListener("change", (event) => handleLogo("regional", event.target.files[0]).catch(showError));
$("jusfyLogoInput").addEventListener("change", (event) => handleLogo("jusfy", event.target.files[0]).catch(showError));
$("resetButton").addEventListener("click", () => {
  pushUndoSnapshot();
  Object.entries(familyFieldDefaults[state.family] || defaults).forEach(([key,value]) => fields[key].value = value); state.familyFields[state.family] = { ...(familyFieldDefaults[state.family] || defaults) }; state.selectedBatch = -1; state.selection = null; state.multiSelection = new Set(); state.layouts = {}; state.selectedLogoId = "caasp";
  localStorage.removeItem("jusfy-creative-draft"); updateCounters(); const logo = state.logoCatalog.find((item) => item.id === "caasp"); if (logo) selectCatalogLogo(logo).catch(showError); else render();
});
$("exportSvgButton").addEventListener("click", exportSvg); $("exportPngButton").addEventListener("click", () => exportPng());
$("saveMasterButton").addEventListener("click", saveApprovedMaster);
$("refreshMastersButton").addEventListener("click", () => loadMasters());
$("loadNotionCopiesButton").addEventListener("click", () => loadNotionCopies(true).catch(showError));
$("includeReviewCopies").addEventListener("change", (event) => { state.includeReviewCopies = event.target.checked; renderCopyLibrary(); });
$("showAllScopes").addEventListener("change", (event) => { state.showAllScopes = event.target.checked; renderCopyLibrary(); });
$("selectVisibleCopiesButton").addEventListener("click", toggleVisibleCopySelection);
$("generateNotionVariationsButton").addEventListener("click", () => generateNotionVariations().catch(showError));
$("selectVisibleLogosButton").addEventListener("click", toggleVisibleLogoSelection);
$("generateLogoVariationsButton").addEventListener("click", () => generateLogoVariations().catch(showError));
$("fontDecrease").addEventListener("click", () => adjustSelectedScale(-.08));
$("fontIncrease").addEventListener("click", () => adjustSelectedScale(.08));
$("alignLeftButton").addEventListener("click", () => setSelectedAlign("left"));
$("alignCenterButton").addEventListener("click", () => setSelectedAlign("center"));
$("alignRightButton").addEventListener("click", () => setSelectedAlign("right"));
$("boldToggleButton").addEventListener("click", () => toggleSelectedBold());
$("italicToggleButton").addEventListener("click", () => toggleSelectedItalic());
$("deleteElementButton").addEventListener("click", () => {
  const keys = state.multiSelection.size ? [...state.multiSelection] : (state.selection ? [state.selection] : []);
  const deletable = keys.filter((key) => !protectedKeys.includes(key) && currentLayout()[key]?.visible);
  if (!deletable.length) return;
  pushUndoSnapshot();
  deletable.forEach((key) => { currentLayout()[key].visible = false; });
  saveLocal(); render();
});
$("restoreElementButton").addEventListener("click", restoreSelected);
$("rulerToggle").addEventListener("click", () => { state.ruler = !state.ruler; localStorage.setItem("jusfy-studio-ruler", state.ruler ? "1" : "0"); syncRulerButton(); updateRulerBars(); render(); });
syncRulerButton();
$("clearGuidesButton").addEventListener("click", () => { pushUndoSnapshot(); state.guides[state.template] = { v:[], h:[] }; saveLocal(); render(); });
$("rulerTop").addEventListener("pointerdown", (event) => beginGuideFromRuler(event, "h"));
$("rulerLeft").addEventListener("pointerdown", (event) => beginGuideFromRuler(event, "v"));
["rulerTop","rulerLeft"].forEach((id) => { const bar = $(id); bar.addEventListener("pointermove", moveGuideDrag); bar.addEventListener("pointerup", endGuideDrag); bar.addEventListener("pointercancel", endGuideDrag); });
$("zoomIn").addEventListener("click", () => { state.zoom = Math.min(1.5, state.zoom + .1); applyZoom(); });
$("zoomOut").addEventListener("click", () => { state.zoom = Math.max(.1, state.zoom - .1); applyZoom(); });
$("approveAllButton").addEventListener("click", () => { state.batch.forEach((item) => { item.review = "approved"; }); renderBatchList(); });
$("exportBatchButton").addEventListener("click", () => exportApprovedBatch().catch(showError));

canvas.addEventListener("pointerdown", (event) => {
  if (state.ruler && !state.guideDrag) {
    const nearGuide = guideNear(canvasPoint(event));
    if (nearGuide) {
      beginChange();
      state.guideDrag = { ...nearGuide, pointerId:event.pointerId };
      try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* eventos sintéticos */ }
      event.preventDefault();
      moveGuideDrag(event); return;
    }
  }
  if (templates[state.template]?.type !== "mapped" || (state.importedSources[state.template] && state.importMode === "original")) return;
  const point = canvasPoint(event);
  const handles = widthHandlePoints();
  if (handles) {
    const tolerance = 10;
    const side = ["left","right"].find((candidate) => Math.abs(point.x - handles[candidate].x) <= tolerance && Math.abs(point.y - handles[candidate].y) <= tolerance);
    if (side) {
      const key = state.selection; const item = currentLayout()[key];
      const spec = resolvedTextSpec(key, currentValues()[key] || elementLabels[key]);
      beginChange();
      state.widthDrag = { key, side, pointerId:event.pointerId, startX:point.x, startWidth:spec.width, startItemX:item.x, align:spec.align || "center" };
      canvas.setPointerCapture(event.pointerId); canvas.classList.add("is-dragging"); event.preventDefault(); render(); return;
    }
  }
  const corners = cornerScaleHandlePoints();
  if (corners) {
    const tolerance = 10;
    const corner = Object.keys(corners).find((key) => Math.abs(point.x - corners[key].x) <= tolerance && Math.abs(point.y - corners[key].y) <= tolerance);
    if (corner) {
      const key = state.selection; const item = currentLayout()[key];
      const startDist = Math.hypot(point.x - item.x, point.y - item.y) || 1;
      beginChange();
      state.scaleDrag = { key, pointerId:event.pointerId, centerX:item.x, centerY:item.y, startDist, startScale:item.scale };
      canvas.setPointerCapture(event.pointerId); canvas.classList.add("is-dragging"); event.preventDefault(); render(); return;
    }
  }
  const hit = [...state.hitAreas].reverse().find((area) => point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height);
  if (!hit) { if (!event.shiftKey) selectElement(null); return; }
  if (event.shiftKey) { toggleElementSelection(hit.key); return; }
  if (!state.multiSelection.has(hit.key)) { state.selection = hit.key; state.multiSelection = new Set([hit.key]); }
  else { state.selection = hit.key; }
  beginChange();
  const item = currentLayout()[hit.key]; state.drag = { key:hit.key, pointerId:event.pointerId, offsetX:point.x - item.x, offsetY:point.y - item.y };
  canvas.setPointerCapture(event.pointerId); canvas.classList.add("is-dragging"); event.preventDefault(); render();
});

canvas.addEventListener("pointermove", (event) => {
  if (state.guideDrag) { moveGuideDrag(event); return; }
  if (state.widthDrag) { moveWidthDrag(event); return; }
  if (state.scaleDrag) { moveScaleDrag(event); return; }
  const point = canvasPoint(event);
  if (!state.drag) {
    const nearGuide = guideNear(point);
    const handles = widthHandlePoints(); const tolerance = 10;
    const nearHandle = handles && ["left","right"].find((side) => Math.abs(point.x - handles[side].x) <= tolerance && Math.abs(point.y - handles[side].y) <= tolerance);
    const corners = cornerScaleHandlePoints();
    const nearCorner = corners && Object.keys(corners).find((key) => Math.abs(point.x - corners[key].x) <= tolerance && Math.abs(point.y - corners[key].y) <= tolerance);
    canvas.style.cursor = nearGuide ? (nearGuide.axis === "v" ? "col-resize" : "row-resize") : nearHandle ? "ew-resize" : nearCorner ? (nearCorner === "tl" || nearCorner === "br" ? "nwse-resize" : "nesw-resize") : "";
    const hit = state.hitAreas.some((area) => point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height);
    canvas.classList.toggle("has-editable-element", !nearGuide && !nearHandle && !nearCorner && hit); return;
  }
  const item = currentLayout()[state.drag.key];
  let nextX = Math.max(0, Math.min(canvas.width, point.x - state.drag.offsetX)); let nextY = Math.max(0, Math.min(canvas.height, point.y - state.drag.offsetY));
  if (state.ruler) {
    const area = state.hitAreas.find((candidate) => candidate.key === state.drag.key);
    if (area) {
      const centerX = area.x + area.width / 2 + (nextX - item.x); const centerY = area.y + area.height / 2 + (nextY - item.y);
      if (Math.abs(centerX - canvas.width / 2) < 6) nextX += canvas.width / 2 - centerX;
      if (Math.abs(centerY - canvas.height / 2) < 6) nextY += canvas.height / 2 - centerY;
      const guides = state.guides[state.template];
      if (guides) {
        const snapAxis = (edges, targets) => { for (const target of targets) for (const edge of edges) if (Math.abs(edge - target) < 6) return target - edge; return 0; };
        const left = area.x + (nextX - item.x); const top = area.y + (nextY - item.y);
        nextX += snapAxis([left + area.width / 2, left, left + area.width], guides.v || []);
        nextY += snapAxis([top + area.height / 2, top, top + area.height], guides.h || []);
      }
    }
  }
  if (state.multiSelection.size > 1) {
    const dx = nextX - item.x; const dy = nextY - item.y;
    state.multiSelection.forEach((key) => {
      if (key === state.drag.key) return;
      const other = currentLayout()[key]; if (!other) return;
      other.x += dx; other.y += dy;
    });
  }
  item.x = nextX; item.y = nextY; render();
});

canvas.addEventListener("pointerup", finishDrag); canvas.addEventListener("pointercancel", finishDrag);
document.addEventListener("keydown", (event) => {
  const target = event.target; const isEditable = target.matches("input,textarea") || target.isContentEditable;
  const withModifier = event.ctrlKey || event.metaKey;
  if (withModifier && !isEditable && event.key.toLowerCase() === "z") {
    event.preventDefault(); if (event.shiftKey) redo(); else undo(); return;
  }
  if (withModifier && !isEditable && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
  if (!state.multiSelection.size || isEditable) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    const keys = [...state.multiSelection].filter((key) => !protectedKeys.includes(key) && currentLayout()[key]?.visible);
    if (!keys.length) return;
    pushUndoSnapshot();
    keys.forEach((key) => { currentLayout()[key].visible = false; });
    saveLocal(); render(); event.preventDefault();
  }
});
window.addEventListener("resize", debounce(fitZoom, 120));

async function startStudio() {
  await loadTemplateCatalog();
  restoreLocal(); applyFamilyFields(state.family); renderFamilySelect(); updateCopyFieldsNotice(); updateCounters();
  const [, , regionalUrl, jusfyUrl] = await Promise.all([
    document.fonts?.load("700 48px Poppins") || Promise.resolve(),
    document.fonts?.load("400 27px Poppins") || Promise.resolve(),
    fetchAsDataUrl("tmp/pdfs/editable-master/logo-caasp.png"),
    fetchAsDataUrl("tmp/pdfs/editable-master/logo-jusfy.png"),
  ]);
  state.logos.regional = await loadImage(regionalUrl); state.logos.jusfy = await loadImage(jusfyUrl);
  state.logoUrls.regional = regionalUrl; state.logoUrls.jusfy = jusfyUrl;
  const results = await Promise.allSettled([loadLogoCatalog(),loadNotionCopies(false),loadMasters(),loadOfferCatalog()]); results.filter((item) => item.status === "rejected").forEach((item) => console.warn(item.reason));
  await loadTemplate(templateKeyFor(state.family,state.format));
}

(async () => {
  try { await startStudio(); } catch (error) { const loadingEl = $("loadingState"); loadingEl.textContent = "Não foi possível carregar os templates. Verifique o servidor local e recarregue a página. Detalhe: " + (error?.message || String(error)); loadingEl.classList.remove("is-hidden"); console.error(error); }
})();
