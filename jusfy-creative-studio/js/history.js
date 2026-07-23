// Desfazer/refazer (Ctrl+Z / Ctrl+Y) para posição, escala, visibilidade de elementos e guias.
// Escopo deliberado: apenas mudanças de layout no canvas. Edição de texto nos campos já tem
// undo nativo do navegador (funciona sozinho enquanto o foco está no input/textarea).
import { state } from "./state.js";
import { render, saveLocal } from "./render.js";

const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];

function snapshot() {
  return JSON.stringify({ layouts: state.layouts, guides: state.guides });
}

function applySnapshot(raw) {
  const data = JSON.parse(raw);
  state.layouts = data.layouts || {};
  state.guides = data.guides || {};
}

export function pushUndoSnapshot() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

// Para gestos contínuos (arrastar, redimensionar, mover guia): captura o "antes" no início do gesto
// e só grava no histórico se algo realmente mudou no final — um clique sem arrastar não vira undo.
let pendingSnapshot = null;

export function beginChange() {
  pendingSnapshot = snapshot();
}

export function commitChange() {
  if (pendingSnapshot === null) return;
  const before = pendingSnapshot; pendingSnapshot = null;
  if (before === snapshot()) return;
  undoStack.push(before);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  saveLocal(); render();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  saveLocal(); render();
}
