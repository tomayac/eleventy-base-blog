import {
  drafts,
  updateDraftData,
  setCurrentDraftId,
} from "../drafts/draft-manager.js";
import { updatePreview } from "./editor-logic.js";
import { deleteDraft, createNewDraft } from "../drafts/draft-manager.js";

let lastSyncedTitle = "";

export const sync = (ui, debouncedPreview, renderList) => {
  const id = localStorage.getItem("current-draft-id");
  updateDraftData(id, ui);
  debouncedPreview(id, ui);
  if (ui.titleInput.value !== lastSyncedTitle) {
    renderList();
    lastSyncedTitle = ui.titleInput.value;
  }
};

export function renderList(ui, loadDraft) {
  ui.draftsListEl.innerHTML = "";
  const currentId = localStorage.getItem("current-draft-id");
  drafts.forEach((d) => {
    const li = document.createElement("li");
    if (d.id === currentId) li.classList.add("active");
    li.onclick = () => loadDraft(d.id);
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "current-draft";
    radio.checked = d.id === currentId;
    const title = document.createElement("span");
    title.className = "draft-title";
    title.textContent = d.title || "Untitled Draft";
    const del = document.createElement("button");
    del.className = "delete-draft-btn";
    del.textContent = "🗑️";
    del.onclick = (e) => {
      e.stopPropagation();
      deleteDraft(
        d.id,
        ui,
        () => createNewDraft(ui, loadDraft, renderList),
        loadDraft,
        renderList,
      );
    };
    li.append(radio, title, del);
    ui.draftsListEl.appendChild(li);
  });
}

export async function loadDraft(id, ui, renderList, tagEditor) {
  const d = drafts.find((draft) => draft.id === id);
  if (!d) return;
  setCurrentDraftId(id);
  ui.titleInput.value = d.title || "";
  ui.descInput.value = d.description || "";
  ui.dateInput.value = d.date || "";
  ui.tagsInput.value = d.tags || "";

  let content = d.content || "";
  let classifierResults = [];

  const match =
    content.match(
      /IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \},\s*confidences: (\[.*?\])/,
    ) || content.match(/IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \}/);
  if (match) {
    try {
      const parsedIds = JSON.parse(match[1]);
      const parsedConfidences = match[2] ? JSON.parse(match[2]) : [];
      if (parsedIds.length > 0) {
        classifierResults = parsedIds.map((id, i) => ({
          id,
          confidence:
            parsedConfidences[i] !== undefined ? parsedConfidences[i] : null,
        }));
      }
    } catch (e) {
      console.warn("Failed to parse categories from content", e);
    }
  }

  ui.contentInput.value = content;
  ui.aiWriterInput.value = "";
  lastSyncedTitle = ui.titleInput.value;
  if (tagEditor) tagEditor.renderPills();

  if (window.renderClassifierResults) {
    await window.renderClassifierResults(ui, classifierResults, () =>
      sync(ui, (id, ui) => updatePreview(id, drafts, ui), renderList),
    );
  }

  updatePreview(id, drafts, ui);
  renderList();
}
