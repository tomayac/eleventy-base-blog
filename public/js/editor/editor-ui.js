import {
  drafts,
  updateDraftData,
  setCurrentDraftId,
} from '../drafts/draft-manager.js';
import { updatePreview } from './editor-logic.js';
export { renderList } from './editor-list-renderer.js';

/**
 * Tracks the last synced title to avoid redundant list renders.
 */
let lastSyncedTitle = '';

/**
 * Synchronizes the UI with the draft data and updates the preview.
 * @param {Object} ui - The UI elements.
 * @param {Function} debouncedPreview - Debounced preview update function.
 * @param {Function} renderListFn - Function to render the draft list.
 */
export const sync = (ui, debouncedPreview, renderListFn) => {
  const id = localStorage.getItem('current-draft-id');
  updateDraftData(id, ui);
  debouncedPreview(id, ui);
  if (ui.titleInput.value !== lastSyncedTitle) {
    renderListFn();
    lastSyncedTitle = ui.titleInput.value;
  }
};

/**
 * Loads a draft's data into the UI.
 * @param {string} id - The draft ID to load.
 * @param {Object} ui - The UI elements.
 * @param {Function} renderList - Function to refresh the draft list.
 * @param {Object} tagEditor - The tag editor component instance.
 */
export async function loadDraft(id, ui, renderList, tagEditor) {
  const d = drafts.find((draft) => draft.id === id);
  if (!d) {
    return;
  }
  setCurrentDraftId(id);
  ui.titleInput.value = d.title || '';
  ui.descInput.value = d.description || '';
  ui.dateInput.value = d.date || '';
  ui.tagsInput.value = d.tags || '';

  const content = d.content || '';
  let classifierResults = [];

  ui.contentInput.value = content;
  ui.aiWriterInput.value = '';
  lastSyncedTitle = ui.titleInput.value;
  if (tagEditor) {
    tagEditor.renderPills();
  }

  if (window.renderClassifierResults) {
    if (d.classifierResults) {
      classifierResults = d.classifierResults;
    } else if (d.ad_categories) {
      const categories = Array.isArray(d.ad_categories)
        ? d.ad_categories
        : [d.ad_categories];
      const confidences = Array.isArray(d.ad_confidences)
        ? d.ad_confidences
        : [d.ad_confidences];
      classifierResults = categories.map((id, i) => ({
        id,
        confidence: confidences[i] ? parseFloat(confidences[i]) : null,
      }));
    } else {
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
                parsedConfidences[i] !== undefined
                  ? parsedConfidences[i]
                  : null,
            }));
          }
        } catch (e) {
          console.warn('Failed to parse categories from content', e);
        }
      }
    }
    await window.renderClassifierResults(ui, classifierResults, () =>
      sync(ui, (id, ui) => updatePreview(id, drafts, ui), renderList),
    );
  }

  updatePreview(id, drafts, ui);
  renderList(ui, loadDraft);
}
