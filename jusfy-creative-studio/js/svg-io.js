// Utilitários de SVG, arquivos, imagens e fontes — sem dependência do estado do Studio.
import { state } from "./state.js";

export function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function readFile(file, mode = "text") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject;
    if (mode === "data") reader.readAsDataURL(file); else reader.readAsText(file);
  });
}

export async function fetchAsDataUrl(path) {
  const response = await fetch(path); if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
  return readFile(await response.blob(), "data");
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
  });
}

export function parseSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.tagName.toLowerCase() !== "svg") throw new Error("SVG inválido");
  return doc;
}

export function svgDimensions(doc) {
  const root = doc.documentElement;
  const vb = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const width = Number.parseFloat(root.getAttribute("width")) || vb[2] || 1080;
  const height = Number.parseFloat(root.getAttribute("height")) || vb[3] || 1080;
  return { width, height };
}

export async function ensureEmbeddedFontUrls() {
  if (state.fontUrls.regular && state.fontUrls.bold) return state.fontUrls;
  state.fontLoadPromise = state.fontLoadPromise || Promise.all([fetchAsDataUrl("assets/fonts/Poppins-Regular.ttf"),fetchAsDataUrl("assets/fonts/Poppins-Bold.ttf")]).then(([regular,bold]) => { state.fontUrls = { regular,bold }; return state.fontUrls; });
  return state.fontLoadPromise;
}

export function embedPoppinsInSvg(svgText) {
  if (!state.fontUrls.regular || !state.fontUrls.bold || /data-studio-fonts=/.test(svgText)) return svgText;
  const css = `<style data-studio-fonts="poppins">@font-face{font-family:'Poppins';src:url('${state.fontUrls.regular}') format('truetype');font-weight:400 600}@font-face{font-family:'Poppins';src:url('${state.fontUrls.bold}') format('truetype');font-weight:700 800}</style>`;
  return svgText.replace(/<svg\b[^>]*>/, (root) => `${root}${css}`);
}

// Faixa de marcas diacríticas combinantes (U+0300–U+036F) usada para remover acentos após NFD.
const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");
export function safeName(name) { return String(name || "criativo").normalize("NFD").replace(DIACRITICS_PATTERN, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(); }

export function download(href, filename) {
  const link = document.createElement("a"); link.href = href; link.download = filename; document.body.append(link); link.click(); link.remove();
}

export function distributeTextLines(value, count) {
  if (count <= 1) return [String(value || "").replace(/\s+/g," ").trim()];
  const words = String(value || "").replace(/\s+/g," ").trim().split(" ").filter(Boolean); const lines = Array.from({length:count},() => "");
  const target = Math.max(1,words.join(" ").length / count); let line = 0;
  words.forEach((word) => { if (line < count - 1 && lines[line] && `${lines[line]} ${word}`.length > target) line += 1; lines[line] += `${lines[line] ? " " : ""}${word}`; });
  return lines;
}
