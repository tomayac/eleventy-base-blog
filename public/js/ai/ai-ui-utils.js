import { checkAIKeys } from "./ai-config.js";
import { customAlert } from "../utils/dialog-utils.js";

export const getMonitor = (ui, lang, modelName) => ({
  monitor(m) {
    m.addEventListener("downloadprogress", (e) => {
      ui.aiStatus.style.display = "flex";
      ui.aiDownloadProgress.value = e.loaded;
      ui.aiDownloadProgress.max = e.total;
      ui.aiStatusText.textContent = `Downloading ${modelName} (${lang}): ${Math.round((e.loaded / e.total) * 100)}%`;
      if (e.loaded === e.total)
        setTimeout(() => (ui.aiStatus.style.display = "none"), 2000);
    });
  },
});

export async function runAIAction(ui, btn, actionFn, updateCallback) {
  if (!checkAIKeys(ui)) return;
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = "⏳";
  ui.activeAiStreams++;
  try {
    await actionFn();
  } catch (err) {
    console.error(err);
    customAlert(ui, "AI Action failed.");
  } finally {
    ui.activeAiStreams--;
    btn.disabled = false;
    btn.textContent = oldText === "⏳" ? "✨" : oldText;
    if (typeof updateCallback === "function") updateCallback();
  }
}

export function refreshAIVisibility(ui) {
  const enabled = ui.aiFeaturesToggle.checked;
  const aiButtons = Array.from(document.querySelectorAll(".ai-button"));
  const isAiSupported = aiButtons.some(
    (btn) => btn?.getAttribute("data-ai-available") === "true",
  );

  if (ui.aiWriterSection)
    ui.aiWriterSection.style.display =
      enabled && isAiSupported ? "block" : "none";
  if (ui.aiRewriterSection)
    ui.aiRewriterSection.style.display =
      enabled && isAiSupported ? "block" : "none";
  if (ui.aiClassifierSection)
    ui.aiClassifierSection.style.display =
      enabled && isAiSupported ? "block" : "none";
  if (!enabled && ui.aiStatus) ui.aiStatus.style.display = "none";
  if (ui.aiKeysSection)
    ui.aiKeysSection.style.display = enabled ? "block" : "none";

  aiButtons.forEach((btn) => {
    if (btn) {
      const isAvailable = btn.getAttribute("data-ai-available") === "true";
      const shouldShow = enabled && isAvailable;
      btn.style.display = shouldShow ? "flex" : "none";
      if (btn.parentElement?.classList.contains("input-with-action")) {
        btn.parentElement.style.display = shouldShow ? "flex" : "block";
      }
    }
  });
}

export function updateUIFields(ui, configs, aiKeys) {
  const currentBackend = ui.aiBackendSelect.value;
  const currentConfig = configs[currentBackend] || {};
  aiKeys.forEach((id) => {
    if (id === "ai-backend") return;
    const key =
      id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) +
      (id.includes("toggle")
        ? ""
        : id.includes("provider") ||
            id.includes("backend") ||
            id.includes("device") ||
            id.includes("dtype")
          ? "Select"
          : "Input");
    const input = ui[key] || document.getElementById(id);
    if (input) {
      const val = currentConfig[id];
      if (input.type === "checkbox") input.checked = val === true;
      else if (val !== undefined) input.value = val;
      else input.value = "";
    }
  });
}
