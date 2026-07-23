// Biblioteca de copies sincronizadas do Notion: filtro por família/escopo e aplicação nos campos.
import { $, state, fields, designFamilies } from "./state.js";
import { copyFieldsFor, activeCopyScopes } from "./catalog.js";
import { regionalize } from "./assets-banks.js";
import { render, saveLocal, updateCounters } from "./render.js";

export function copiesForFamily() {
  return state.copies.filter((item) => item.status === "Aprovada" || (state.includeReviewCopies && item.status === "Em revisão")).filter((item) => {
    const families = item.families || item.models || item.templates;
    return !Array.isArray(families) || !families.length || families.includes(state.family);
  });
}

export function visibleCopies() {
  const items = copiesForFamily();
  const scopes = activeCopyScopes();
  if (!scopes.length || state.showAllScopes) return items;
  return items.filter((item) => {
    const scope = String(item.scope || "").trim().toLowerCase();
    return !scope || scopes.includes(scope);
  });
}

export function applyNotionCopy(item) {
  copyFieldsFor(state.family).forEach((name) => { fields[name].value = regionalize(item[name]); });
  state.selectedBatch = -1; updateCounters(); saveLocal(); render();
  $("copyLibraryStatus").textContent = `${item.variation} aplicada para ${state.selectedRegion}.`;
}

export function renderCopyLibrary() {
  const host = $("copyLibrary"); host.replaceChildren(); const items = visibleCopies();
  items.forEach((item) => {
    const card = document.createElement("article"); card.className = "copy-card";
    const check = document.createElement("input"); check.type = "checkbox"; check.checked = state.copySelection.has(item.id); check.setAttribute("aria-label", `Selecionar ${item.variation}`);
    check.addEventListener("change", () => { if (check.checked) state.copySelection.add(item.id); else state.copySelection.delete(item.id); renderCopyLibrary(); });
    const content = document.createElement("div"); const top = document.createElement("span"); const title = document.createElement("strong"); title.textContent = item.variation;
    const badge = document.createElement("em"); badge.className = item.status === "Aprovada" ? "approved" : "review"; badge.textContent = item.status; top.append(title,badge);
    const headline = document.createElement("small"); headline.textContent = item.headline; const angle = document.createElement("i"); angle.textContent = item.angle || "Sem ângulo";
    content.append(top,headline,angle); const use = document.createElement("button"); use.type = "button"; use.textContent = "Usar"; use.addEventListener("click", () => applyNotionCopy(item));
    card.append(check,content,use); host.append(card);
  });
  const approved = state.copies.filter((item) => item.status === "Aprovada").length; const review = state.copies.filter((item) => item.status === "Em revisão").length;
  const synced = state.copyMeta.syncedAt ? new Date(state.copyMeta.syncedAt).toLocaleString("pt-BR") : "ainda não sincronizado";
  const scopes = designFamilies[state.family]?.copyScopes || [];
  const scopeFilterActive = Boolean(activeCopyScopes().length);
  $("scopeFilterToggle").hidden = !scopeFilterActive;
  $("showAllScopes").checked = state.showAllScopes;
  const hiddenByScope = scopeFilterActive && !state.showAllScopes ? copiesForFamily().length - items.length : 0;
  const scopeNote = scopeFilterActive && !state.showAllScopes ? ` · Filtrando pelo escopo: ${scopes.join(", ")} · ${hiddenByScope} copy(ies) oculta(s)` : "";
  $("copyLibraryStatus").textContent = `${approved} aprovada(s) · ${review} em revisão · ${designFamilies[state.family]?.label} · ${synced}${scopeNote}`;
  $("selectVisibleCopiesButton").textContent = items.length && items.every((item) => state.copySelection.has(item.id)) ? "Limpar seleção" : "Selecionar visíveis";
}

export async function loadNotionCopies(sync = false) {
  const button = $("loadNotionCopiesButton"); button.disabled = true; button.textContent = sync ? "Atualizando…" : "Carregando…";
  try {
    const response = await fetch(sync ? "/api/copies/sync" : "/api/copies", { method:sync ? "POST" : "GET" });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as copies.");
    state.copies = payload.items || []; state.copyMeta = payload; renderCopyLibrary();
    if (payload.message) $("copySyncMessage").textContent = payload.message;
    else $("copySyncMessage").textContent = payload.live ? "Sincronização ao vivo concluída." : "Catálogo local sincronizado a partir do Notion.";
  } finally {
    button.disabled = false; button.textContent = "Atualizar do Notion";
  }
}

export function toggleVisibleCopySelection() {
  const items = visibleCopies(); const allSelected = items.length && items.every((item) => state.copySelection.has(item.id));
  items.forEach((item) => { if (allSelected) state.copySelection.delete(item.id); else state.copySelection.add(item.id); }); renderCopyLibrary();
}
