import { detectLanguage } from "./ai-language-detection.js";
import { customAlert } from "../utils/dialog-utils.js";
import { refreshAIVisibility } from "./ai-toggle.js";
import { getMonitor, runAIAction } from "./ai-ui-utils.js";
export { getMonitor, runAIAction };

const getSummarizerOptions = (ui, lang, type) => ({
  type,
  format: "plain-text",
  expectedInputLanguages: [lang],
  outputLanguage: lang,
  ...getMonitor(ui, lang, "AI Summarizer"),
});

async function runSummarizer(ui, type, input, targetInput, updateCallback) {
  if (!input || input.length < 20)
    return customAlert(ui, "Please write some content first.");
  const btn =
    type === "headline" ? ui.aiSuggestTitleBtn : ui.aiSuggestDescriptionBtn;

  await runAIAction(
    ui,
    btn,
    async () => {
      const lang = await detectLanguage(input);
      const options = getSummarizerOptions(ui, lang, type);
      const status = await Summarizer.availability(options);
      if (status === "unavailable")
        throw new Error(`Summarizer unavailable for: ${lang}`);
      const summarizer = await Summarizer.create(options);
      const stream = summarizer.summarizeStreaming(input);
      targetInput.value = "";
      for await (const chunk of stream) {
        targetInput.value += chunk;
        updateCallback();
      }
      targetInput.value = targetInput.value.trim().replace(/^["']|["']$/g, "");
      if (type === "headline")
        targetInput.value = targetInput.value.replace(/\.$/, "");
    },
    updateCallback,
  );
}

export async function initAI(ui, updateCallback) {
  if (!("Summarizer" in self)) await import("/js/task-apis/summarizer.js");
  if (typeof Summarizer !== "undefined") {
    try {
      const status = await Summarizer.availability({
        type: "teaser",
        format: "plain-text",
      });
      if (status !== "unavailable") {
        ui.aiSuggestTitleBtn.setAttribute("data-ai-available", "true");
        ui.aiSuggestDescriptionBtn.setAttribute("data-ai-available", "true");
        refreshAIVisibility(ui);
      }
      if (status === "downloadable" || status === "downloading") {
        ui.aiStatus.style.display = "flex";
        ui.aiStatusText.textContent = "AI model available (needs download)";
      }
    } catch (e) {
      console.warn("AI Summarizer availability check failed", e);
    }
  }
  ui.aiSuggestTitleBtn.onclick = () =>
    runSummarizer(
      ui,
      "headline",
      ui.contentInput.value,
      ui.titleInput,
      updateCallback,
    );
  ui.aiSuggestDescriptionBtn.onclick = () => {
    const input = `Title: ${ui.titleInput.value}\n\nContent: ${ui.contentInput.value}`;
    runSummarizer(ui, "teaser", input, ui.descInput, updateCallback);
  };
}
