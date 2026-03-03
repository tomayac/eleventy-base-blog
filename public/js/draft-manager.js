import { deleteImagesForDraft, cleanupOrphanedImages } from "./db-storage.js";
import { customConfirm } from "./dialog-utils.js";

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
  const allValidImageIds = [];
  drafts.forEach((draft) => {
    if (!draft.imageFiles || !draft.content) return;
    // Filter imageFiles to only those actually referenced in the content string
    draft.imageFiles = draft.imageFiles.filter((img) => {
      const isReferenced = draft.content.includes(`./${img.name}`);
      if (isReferenced) allValidImageIds.push(img.id);
      return isReferenced;
    });
  });
  saveDrafts();
  await cleanupOrphanedImages(allValidImageIds);
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

  // Get classifier IDs from UI if possible
  if (window.getSelectedClassifierIds) {
    draft.classifierIds = window.getSelectedClassifierIds();
  }

  draft.lastModified = Date.now();
  saveDrafts();
}
