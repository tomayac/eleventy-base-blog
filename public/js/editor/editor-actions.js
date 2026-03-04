import { performHousekeeping } from "../drafts/draft-manager.js";
import { generateMarkdown, downloadZIP } from "../export/zip-exporter.js";
import { createPR } from "../github/github-integration.js";
import { customAlert } from "../utils/dialog-utils.js";

export function initEditorActions(ui, drafts) {
  ui.copyBtn.onclick = () => {
    const id = localStorage.getItem("current-draft-id");
    const d = drafts.find((draft) => draft.id === id);
    const classifierResults = window.getSelectedClassifierResults
      ? window.getSelectedClassifierResults()
      : [];
    const md = generateMarkdown(
      d,
      ui.titleInput.value,
      ui.descInput.value,
      ui.dateInput.value,
      ui.tagsInput.value,
      ui.contentInput.value,
      classifierResults,
    );
    navigator.clipboard
      .writeText(md)
      .then(() => {
        const oldText = ui.copyBtn.textContent;
        ui.copyBtn.textContent = "✅ Copied!";
        setTimeout(() => (ui.copyBtn.textContent = oldText), 2000);
      })
      .catch(() => customAlert(ui, "Failed to copy to clipboard."));
  };

  ui.downloadBtn.onclick = async () => {
    await performHousekeeping();
    const id = localStorage.getItem("current-draft-id");
    const d = drafts.find((draft) => draft.id === id);
    const classifierResults = window.getSelectedClassifierResults
      ? window.getSelectedClassifierResults()
      : [];
    downloadZIP(
      d,
      ui.titleInput.value,
      ui.descInput.value,
      ui.dateInput.value,
      ui.tagsInput.value,
      ui.contentInput.value,
      classifierResults,
    );
  };

  ui.githubPrBtn.onclick = async () => {
    await performHousekeeping();
    const id = localStorage.getItem("current-draft-id");
    const d = drafts.find((draft) => draft.id === id);
    createPR(ui, d);
  };
}
