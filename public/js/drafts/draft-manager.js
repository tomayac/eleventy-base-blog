import { deleteImagesForDraft } from "../utils/db-storage.js";
import { customConfirm } from "../utils/dialog-utils.js";
import { performHousekeeping as h_performHousekeeping } from "./draft-housekeeping.js";

export let drafts = JSON.parse(localStorage.getItem("blog-drafts") || "[]");
export let currentDraftId = localStorage.getItem("current-draft-id");

export function setCurrentDraftId(id) {
  currentDraftId = id;
  localStorage.setItem("current-draft-id", id);
}

export function saveDrafts() {
  localStorage.setItem("blog-drafts", JSON.stringify(drafts));
}

export function saveCurrentDraft(id, ui) {
  updateDraftData(id, ui);
}

export async function createNewDraft(ui, loadDraftFn, renderListFn) {
  const id = Date.now().toString();
  const newDraft = {
    id,
    title: "",
    description: "",
    date: "",
    tags: "",
    content: "",
    imageFiles: [],
    lastModified: Date.now(),
  };
  drafts.unshift(newDraft);
  setCurrentDraftId(id);
  saveDrafts();
  await loadDraftFn(id);
  renderListFn();
}

export async function performHousekeeping() {
  await h_performHousekeeping(drafts, saveDrafts);
}

export async function deleteDraft(
  id,
  ui,
  createNewDraftFn,
  loadDraftFn,
  renderListFn,
) {
  const confirmed = await customConfirm(
    ui,
    "Are you sure you want to delete this draft?",
  );
  if (!confirmed) return;
  await deleteImagesForDraft(id);
  drafts = drafts.filter((d) => d.id !== id);
  saveDrafts();

  // Comprehensive cleanup
  await performHousekeeping();

  if (currentDraftId === id) {
    if (drafts.length > 0) loadDraftFn(drafts[0].id);
    else createNewDraftFn();
  } else {
    renderListFn();
  }
}

export function updateDraftData(id, ui) {
  const draft = drafts.find((d) => d.id === id);
  if (!draft) return;
  draft.title = ui.titleInput.value;
  draft.description = ui.descInput.value;
  draft.date = ui.dateInput.value;
  draft.tags = ui.tagsInput.value;
  draft.content = ui.contentInput.value;

  // Get classifier results from UI if possible
  if (window.getSelectedClassifierResults) {
    draft.classifierResults = window.getSelectedClassifierResults();
  }

  draft.lastModified = Date.now();
  saveDrafts();
}
