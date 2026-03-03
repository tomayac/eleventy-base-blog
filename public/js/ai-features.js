import { detectLanguage } from "./ai-language-detection.js";
import { customAlert } from "./dialog-utils.js";
import { checkAIKeys } from "./ai-config.js";
import { refreshAIVisibility } from "./ai-toggle.js";

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
