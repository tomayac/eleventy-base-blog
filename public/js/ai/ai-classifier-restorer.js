import { renderClassifierResults } from "./ai-classifier-renderer.js";

/**
 * Parses advertising categories from the content string or restores them from the draft object.
 * @param {Object} ui - The UI elements.
 * @param {Function} updateCallback - Callback to trigger after restoration.
 */
export async function restoreClassifierResults(ui, updateCallback) {
  const content = ui.contentInput.value;
  const match =
    content.match(
      /IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \},\s*confidences: (\[.*?\])/,
    ) || content.match(/IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \}/);

  let results = [];
  if (match) {
    try {
      const ids = JSON.parse(match[1]);
      const confidences = match[2] ? JSON.parse(match[2]) : [];
      if (ids.length > 0) {
        results = ids.map((id, i) => ({
          id,
          confidence: confidences[i] !== undefined ? confidences[i] : null,
        }));
      }
    } catch (e) {
      console.warn("Initial category restoration from content failed", e);
    }
  }

  // Fallback to draft data if content parsing failed or returned no results
  if (results.length === 0) {
    const id = localStorage.getItem("current-draft-id");
    const drafts = JSON.parse(localStorage.getItem("blog-drafts") || "[]");
    const draft = drafts.find((d) => d.id === id);
    if (draft) {
      if (draft.classifierResults) {
        results = draft.classifierResults;
      } else if (draft.ad_categories) {
        const categories = Array.isArray(draft.ad_categories)
          ? draft.ad_categories
          : [draft.ad_categories];
        const confidences = Array.isArray(draft.ad_confidences)
          ? draft.ad_confidences
          : [draft.ad_confidences];
        results = categories.map((id, i) => ({
          id,
          confidence: confidences[i] ? parseFloat(confidences[i]) : null,
        }));
      }
    }
  }

  if (results.length > 0) {
    await renderClassifierResults(ui, results, updateCallback);
  }
}
