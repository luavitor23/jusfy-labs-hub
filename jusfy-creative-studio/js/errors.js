// Handler de erro compartilhado, usado como .catch(showError) nas ações assíncronas da UI.
import { $ } from "./state.js";

export function showError(error) {
  console.error(error);
  $("batchMessage").textContent = error.message || "Não foi possível concluir a operação.";
  $("batchMessage").classList.add("error");
}
