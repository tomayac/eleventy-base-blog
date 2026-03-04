import { updateDraftData } from "../drafts/draft-manager.js";
import { customAlert } from "../utils/dialog-utils.js";
import { getMonitor, runAIAction } from "./ai-features.js";
import { refreshAIVisibility } from "./ai-toggle.js";
import {
  renderClassifierResults,
  updateScriptTagInContent,
} from "./ai-classifier-renderer.js";

export async function initAIClassifier(ui, updateCallback) {
  if (!ui.aiClassifierBtn) return;
  if (!("Classifier" in self)) {
    try {
      await import("/js/task-apis/classifier.js");
    } catch (e) {
      console.error("Failed to load Classifier polyfill", e);
      return;
    }
  }
  const ClassifierClass = self.Classifier;

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

  if (ClassifierClass) {
    try {
      const status = await ClassifierClass.availability();
      if (status !== "unavailable") {
        ui.aiClassifierSection?.setAttribute("data-ai-available", "true");
        ui.aiClassifierBtn?.setAttribute("data-ai-available", "true");
        refreshAIVisibility(ui);
      }
    } catch (e) {
      console.warn("AI Classifier availability check failed", e);
    }
  }

  window.addEventListener("classifier-updated", () => {
    const id = localStorage.getItem("current-draft-id");
    if (id) {
      updateDraftData(id, ui);
      updateScriptTagInContent(ui);
    }
  });

  ui.aiClassifierBtn.onclick = async () => {
    const title = ui.titleInput.value.trim();
    const content = ui.contentInput.value.trim();
    if (!title && !content)
      return customAlert(ui, "Please provide a title or content first.");

    const input = `Title: ${title}\n\nContent: ${content}`;
    await runAIAction(
      ui,
      ui.aiClassifierBtn,
      async () => {
        ui.aiClassifierResults.innerHTML = "Classifying...";
        const monitor = getMonitor(ui, "en", "Classifier");
        const classifier = await ClassifierClass.create({ ...monitor });
        const results = await classifier.classify(input);

        if (results && results.length > 0) {
          const filteredResults = results.filter((res) => res.id !== "unknown");
          if (filteredResults.length === 0) {
            ui.aiClassifierResults.innerHTML = "No categories found.";
            return;
          }
          await renderClassifierResults(ui, filteredResults, updateCallback);
          window.dispatchEvent(new CustomEvent("classifier-updated"));
        } else {
          ui.aiClassifierResults.innerHTML = "No categories found.";
        }
      },
      updateCallback,
    );
  };
}
