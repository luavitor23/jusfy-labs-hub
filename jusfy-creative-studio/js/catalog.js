// Catálogo de modelos: carregamento do /api/templates, layout por família e campos de copy permitidos.
import { $, state, defaults, templates, designFamilies, setCatalog, familyDefaultOffer } from "./state.js";

export function familyCobranding(family = state.family) { return designFamilies[family]?.cobranding !== false; }

export function createLayout(key) {
  const spec = templates[key];
  const enabled = spec.enabledFields || ["category", "headline", "support", "cta"];
  const logoMode = familyCobranding(spec.family) ? "cobrand" : "jusfy";
  const layout = {
    category: { x:spec.category.x, y:spec.category.y, scale:1, visible:enabled.includes("category"), align:null, bold:null, italic:false },
    headline: { x:spec.headline.x, y:spec.headline.y, scale:1, visible:enabled.includes("headline"), align:null, bold:null, italic:false },
    support: { x:spec.support.x, y:spec.support.y, scale:1, visible:enabled.includes("support"), align:null, bold:null, italic:false },
    cta: { x:spec.cta.x, y:spec.cta.y, scale:1, visible:enabled.includes("cta"), align:null, bold:null, italic:false },
    logoGroup: { x:spec.logos.x, y:spec.logos.y, scale:1, visible:true, mode:logoMode },
  };
  if (spec.commercial) {
    layout.commercialBlock = { x:spec.commercial.centerX, y:spec.commercial.centerY, scale:1, visible:true };
    layout.commercialOffer = familyDefaultOffer[spec.family] || "";
  }
  if (spec.priceRegionNote) layout.priceRegionNote = { x:spec.priceRegionNote.x, y:spec.priceRegionNote.y, scale:1, visible:true };
  Object.entries(spec.freeElements || {}).forEach(([elementKey, elementSpec]) => {
    const [bx,by,bw,bh] = elementSpec.bounds;
    layout[elementKey] = { x:bx + bw / 2, y:by + bh / 2, scale:1, visible:true };
  });
  return layout;
}

export function currentLayout() {
  if (templates[state.template]?.type === "mapped") {
    const defaultsForTemplate = createLayout(state.template);
    if (!state.layouts[state.template]) state.layouts[state.template] = defaultsForTemplate;
    else Object.entries(defaultsForTemplate).forEach(([key, value]) => { if (!state.layouts[state.template][key]) state.layouts[state.template][key] = value; });
    if (state.layouts[state.template].logoGroup && !state.layouts[state.template].logoGroup.mode) state.layouts[state.template].logoGroup.mode = "cobrand";
    if (state.layouts[state.template].logoGroup && !familyCobranding(templates[state.template].family)) state.layouts[state.template].logoGroup.mode = "jusfy";
  }
  return state.layouts[state.template];
}

export function resolvedTextSpec(key, value = "") {
  const base = templates[state.template][key]; const item = currentLayout()[key];
  const scaledMax = base.maxSize * item.scale; const scaledMin = base.minSize * item.scale;
  const length = String(value).replace(/\s+/g," ").trim().length; let responsiveMax = scaledMax;
  if (base.referenceLength && length > base.referenceLength) responsiveMax *= Math.pow(base.referenceLength / length, base.lengthScaling ?? .5);
  const align = item.align || base.align || "center";
  const weight = item.bold === undefined || item.bold === null ? base.weight : (item.bold ? "700" : "400");
  const italic = Boolean(item.italic);
  return { ...base, x:item.x, y:item.y, width:item.width ?? base.width, align, weight, italic, maxSize:Math.max(scaledMin,Math.min(scaledMax,responsiveMax)), minSize:scaledMin };
}

export async function loadTemplateCatalog() {
  const response = await fetch("/api/templates");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o catálogo de modelos.");
  const nextTemplates = {}; const nextFamilies = {}; const nextDefaults = {};
  (payload.models || []).forEach((model) => {
    const formats = {};
    Object.entries(model.formats || {}).forEach(([format, rawSpec]) => {
      const key = rawSpec.key || `${model.id}-${format}`;
      nextTemplates[key] = { ...rawSpec, family:model.id, format };
      formats[format] = key;
    });
    nextFamilies[model.id] = { label:model.label, description:model.description, copyTags:model.copyTags || [], copyFields:model.copyFields || ["headline","support","cta"], cobranding:model.cobranding !== false, copyScopes:model.copyScopes || [], formats };
    nextDefaults[model.id] = { ...defaults, ...(model.defaults || {}) };
  });
  if (!Object.keys(nextTemplates).length) throw new Error("O catálogo não contém modelos ativos.");
  setCatalog(nextTemplates, nextFamilies, nextDefaults);
  const firstFamily = Object.keys(designFamilies)[0];
  if (!designFamilies[state.family]) state.family = firstFamily;
  if (!templates[state.template] || templates[state.template].family !== state.family) state.template = templateKeyFor(state.family,state.format);
}

export function renderFamilySelect() {
  const select = $("familySelect"); select.replaceChildren();
  Object.entries(designFamilies).forEach(([id,family]) => { const option = document.createElement("option"); option.value = id; option.textContent = `${family.label} · ${family.description}`; select.append(option); });
  select.value = state.family; $("familyDescription").textContent = designFamilies[state.family]?.description || "";
}

export function templateKeyFor(family = state.family, format = state.format) { return designFamilies[family]?.formats?.[format] || "square"; }

export const COPY_FIELD_LABELS = { headline:"a headline", support:"o texto de apoio", cta:"o CTA" };

export function copyFieldsFor(family = state.family) {
  const allowed = designFamilies[family]?.copyFields;
  return Array.isArray(allowed) && allowed.length ? allowed : ["headline","support","cta"];
}

export function updateCopyFieldsNotice() {
  const notice = $("copyFieldsNotice"); if (!notice) return;
  const used = copyFieldsFor(state.family);
  if (used.length >= 3) { notice.hidden = true; notice.textContent = ""; return; }
  const label = designFamilies[state.family]?.label || state.family;
  const names = used.map((name) => COPY_FIELD_LABELS[name] || name);
  const list = names.length === 1 ? names[0] : `${names.slice(0,-1).join(", ")} e ${names[names.length-1]}`;
  notice.textContent = `O ${label} usa apenas ${list} das copies; os demais textos seguem o padrão do modelo.`;
  notice.hidden = false;
}

export function activeCopyScopes(family = state.family) {
  const scopes = designFamilies[family]?.copyScopes;
  return Array.isArray(scopes) ? scopes.map((scope) => String(scope).trim().toLowerCase()).filter(Boolean) : [];
}
