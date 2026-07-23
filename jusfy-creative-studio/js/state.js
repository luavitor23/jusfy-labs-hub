// Estado compartilhado, referências de DOM e constantes usadas em todos os módulos do Studio.

export const canvas = document.getElementById("creativeCanvas");
export const ctx = canvas.getContext("2d");

export const fields = {
  category: document.getElementById("categoryInput"),
  headline: document.getElementById("headlineInput"),
  support: document.getElementById("supportInput"),
  cta: document.getElementById("ctaInput"),
};

export const defaults = {
  category: "CONDIÇÃO ESPECIAL",
  headline: "Sua advocacia pode produzir mais sem transformar a rotina em mais trabalho",
  support: "Automatize cálculos, pesquisas e tarefas jurídicas com as soluções integradas da Jusfy para advogados.",
  cta: "Aproveite as condições especiais da OAB/SP",
};

export let familyFieldDefaults = {};
export let templates = {};
export let designFamilies = {};

// loadTemplateCatalog (catalog.js) é o único ponto que troca o catálogo inteiro;
// as demais telas só leem ou mutam propriedades destes objetos.
export function setCatalog(nextTemplates, nextFamilies, nextDefaults) {
  templates = nextTemplates;
  designFamilies = nextFamilies;
  familyFieldDefaults = nextDefaults;
}

export const state = {
  template: "square", family:"conditions", format:"square", sourceText: "", sourceImage: null, sourceName: "",
  custom: false, liveTextNodes: [], liveImageNodes: [], zoom: 1, importMode: "mapped",
  fontUrls: { regular:"", bold:"" }, fontLoadPromise: null,
  offerCatalog: [], offerAssets: {},
  importedSources: { square:null, story:null },
  logos: { regional: null, jusfy: null }, logoUrls: { regional: "", jusfy: "" }, regionalIsLockup: false,
  logoCatalog: [], selectedLogoId: "caasp", selectedRegion: "OAB/SP", logoSelection: new Set(),
  copies: [], copySelection: new Set(), copyMeta: {}, includeReviewCopies: false, showAllScopes: false,
  familyFields: {},
  batch: [], selectedBatch: -1, layouts: {}, selection: null, multiSelection: new Set(), hitAreas: [], drag: null, widthDrag: null, scaleDrag: null,
  ruler: localStorage.getItem("jusfy-studio-ruler") === "1",
  guides: {}, guideDrag: null,
  masters: [],
  freeElementCrops: {},
};

export const textKeys = ["category", "headline", "support", "cta"];
export const logoKeys = ["logoGroup"];
export const protectedKeys = ["commercialBlock"];
export const commercialLayoutVersion = 2;
export const priceRegionNoteText = "para advogados da OAB/PI e depois";
export const elementLabels = {
  category: "Categoria", headline: "Headline", support: "Texto de apoio", cta: "CTA regional",
  logoGroup: "Composto de logos", commercialBlock: "Bloco comercial",
};
export const familyDefaultOffer = { conditions:"atual-modelo-1", manual:"atual-modelo-2", model3:"atual-modelo-3", model5:"atual-modelo-5" };

export const $ = (id) => document.getElementById(id);
export const debounce = (fn, wait = 180) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; };
