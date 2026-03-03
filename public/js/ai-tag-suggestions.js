import { detectLanguage } from "./ai-language-detection.js";
import { customAlert } from "./dialog-utils.js";
import { runAIAction } from "./ai-features.js";
import { refreshAIVisibility } from "./ai-toggle.js";

export async function initTagSuggestions(ui, updateCallback) {
  if (!("LanguageModel" in self)) await import("/js/prompt-api-polyfill.js");
  let tagsSchema = null;
  const fetchSchema = async () => {
    if (!tagsSchema)
      tagsSchema = await (await fetch("/tags-schema.json")).json();
    return tagsSchema;
  };
  try {
    const status = await LanguageModel.availability({
      initialPrompts: [
        { role: "system", content: "Suggest tags for this blog post." },
      ],
    });
    if (status !== "unavailable") {
      ui.aiSuggestTagsBtn.setAttribute("data-ai-available", "true");
      refreshAIVisibility(ui);
    }
  } catch (e) {
    console.warn("AI LanguageModel availability check failed", e);
  }

  ui.aiSuggestTagsBtn.onclick = async () => {
    const content = ui.contentInput.value;
    if (!content || content.length < 20)
      return customAlert(ui, "Please write some content first.");

    await runAIAction(
      ui,
      ui.aiSuggestTagsBtn,
      async () => {
        const onlyExisting = ui.aiOnlyExistingTagsToggle.checked;
        const finalTags = new Map();
        const addTags = (tags) => {
          if (!Array.isArray(tags)) return;
          tags.forEach((t) => {
            const trimmed = t.trim();
            const lower = trimmed.toLowerCase();
            if (trimmed && !finalTags.has(lower)) finalTags.set(lower, trimmed);
          });
          ui.tagsInput.value = Array.from(finalTags.values()).join(", ");
          updateCallback();
        };

        const lang = await detectLanguage(content);
        const schema = await fetchSchema();
        const runRestricted = async () => {
          const opts = {
            initialPrompts: [
              {
                role: "system",
                content: `Suggest tags for this blog post in ${lang}. Only use the tags provided in the schema.`,
              },
            ],
          };
          const session = await LanguageModel.create(opts);
          let full = "";
          const stream = session.promptStreaming(`Content: ${content}`, {
            responseConstraint: schema,
          });
          for await (const chunk of stream) {
            full += chunk;
            try {
              addTags(JSON.parse(full).tags);
            } catch (e) {}
          }
        };
        const runFreeform = async () => {
          const opts = {
            initialPrompts: [
              {
                role: "system",
                content: `Suggest 3-5 tags for this blog post in ${lang}. Return JSON: {"tags": ["tag1", "tag2"]}.`,
              },
            ],
          };
          const session = await LanguageModel.create(opts);
          let full = "";
          const stream = session.promptStreaming(`Content: ${content}`, {
            responseConstraint: {
              type: "object",
              properties: {
                tags: { type: "array", items: { type: "string" } },
              },
            },
          });
          for await (const chunk of stream) {
            full += chunk;
            try {
              addTags(JSON.parse(full).tags);
            } catch (e) {}
          }
        };
        const tasks = [runRestricted()];
        if (!onlyExisting) tasks.push(runFreeform());
        await Promise.all(tasks);
      },
      updateCallback,
    );
  };
}
