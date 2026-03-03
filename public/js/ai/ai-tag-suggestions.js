import { detectLanguage } from "./ai-language-detection.js";
import { customAlert } from "../utils/dialog-utils.js";
import { runAIAction } from "./ai-features.js";
import { refreshAIVisibility } from "./ai-toggle.js";
import { runTagGeneration } from "./ai-tag-generator.js";

export async function initTagSuggestions(ui, updateCallback) {
  if (!("LanguageModel" in self)) await import("/js/prompt-api-polyfill.js");
  let tagsSchema = null;
  const fetchSchema = async () =>
    tagsSchema ||
    (tagsSchema = await (await fetch("/tags-schema.json")).json());

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
            const trimmed = t.trim(),
              lower = trimmed.toLowerCase();
            if (trimmed && !finalTags.has(lower)) finalTags.set(lower, trimmed);
          });
          ui.tagsInput.value = Array.from(finalTags.values()).join(", ");
          updateCallback();
        };

        const lang = await detectLanguage(content);
        const schema = await fetchSchema();

        const tasks = [
          LanguageModel.create({
            initialPrompts: [
              {
                role: "system",
                content: `Suggest tags for this blog post in ${lang}. Only use the tags provided in the schema.`,
              },
            ],
          }).then((s) => runTagGeneration(s, content, schema, addTags, true)),
        ];

        if (!onlyExisting) {
          tasks.push(
            LanguageModel.create({
              initialPrompts: [
                {
                  role: "system",
                  content: `Suggest 3-5 tags for this blog post in ${lang}. Return JSON: {"tags": ["tag1", "tag2"]}.`,
                },
              ],
            }).then((s) =>
              runTagGeneration(s, content, schema, addTags, false),
            ),
          );
        }
        await Promise.all(tasks);
      },
      updateCallback,
    );
  };
}
