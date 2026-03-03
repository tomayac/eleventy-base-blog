import { detectLanguage } from "./ai-language-detection.js";
import { customAlert } from "./dialog-utils.js";
import { getMonitor, runAIAction } from "./ai-features.js";
import { refreshAIVisibility } from "./ai-toggle.js";

const getRewriterOptions = (ui, lang) => ({
  sharedContext: "The user is rewriting a blog post.",
  tone: ui.aiRewriterTone.value,
  format: "markdown",
  length: ui.aiRewriterLength.value,
  expectedInputLanguages: [lang],
  outputLanguage: lang,
  ...getMonitor(ui, lang, "Rewriter"),
});

export async function initAIRewriter(ui, updateCallback) {
  if (!("Rewriter" in self)) await import("/js/task-apis/rewriter.js");
  if (typeof Rewriter !== "undefined") {
    try {
      const status = await Rewriter.availability({
        sharedContext: "Rewriting a blog post.",
      });
      if (status !== "unavailable") {
        ui.aiRewriterSection.setAttribute("data-ai-available", "true");
        ui.aiRewriterBtn.setAttribute("data-ai-available", "true");
        refreshAIVisibility(ui);
      }
    } catch (e) {
      console.warn("AI Rewriter availability check failed", e);
    }
  }

  ui.aiRewriterBtn.onclick = async () => {
    const fullContent = ui.contentInput.value.trim();
    if (!fullContent)
      return customAlert(ui, "Please write some content first.");

    await runAIAction(
      ui,
      ui.aiRewriterBtn,
      async () => {
        const parts = fullContent.split(/(<figure>[\s\S]*?<\/figure>)/g);
        ui.contentInput.value = "";
        const lang = await detectLanguage(fullContent);
        const options = getRewriterOptions(ui, lang);
        const rewriter = await Rewriter.create(options);

        for (const part of parts) {
          if (part.startsWith("<figure>")) {
            ui.contentInput.value =
              ui.contentInput.value.trimEnd() + "\n\n" + part + "\n\n";
            updateCallback();
          } else if (part.trim()) {
            const stream = rewriter.rewriteStreaming(part);
            for await (const chunk of stream) {
              ui.contentInput.value += chunk;
              updateCallback();
            }
          }
        }
      },
      () => {
        ui.aiRewriterTone.value = "as-is";
        ui.aiRewriterLength.value = "as-is";
        updateCallback();
      },
    );
  };
}
