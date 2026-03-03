import { getImage } from "../utils/db-storage.js";
import { sanitizeHTML } from "../utils/sanitizer.js";

function formatPreviewDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const blobCache = new Map();

export async function updatePreview(currentId, drafts, ui) {
  const draft = drafts.find((d) => d.id === currentId);
  if (!draft) return;
  let content = ui.contentInput.value;
  if (draft.imageFiles) {
    for (const img of draft.imageFiles) {
      let blobUrl = blobCache.get(img.id);
      if (!blobUrl) {
        const data = await getImage(img.id);
        if (data) {
          const type =
            img.type ||
            (img.name.toLowerCase().endsWith(".svg")
              ? "image/svg+xml"
              : "image/jpeg");
          blobUrl = URL.createObjectURL(new Blob([data], { type }));
          blobCache.set(img.id, blobUrl);
        }
      }
      if (blobUrl) content = content.replaceAll(`./${img.name}`, blobUrl);
    }
  }
  const tagsHtml = ui
    .getTags()
    .map((t) => `<li><a href="#" class="post-tag">${t}</a></li>`)
    .join("");
  const dateHtml = ui.dateInput.value
    ? `<time datetime="${ui.dateInput.value}">${formatPreviewDate(ui.dateInput.value)}</time>`
    : "";
  const titleHtml = ui.titleInput.value
    ? `<h1>${ui.titleInput.value}</h1>`
    : "";
  const metadataHtml =
    dateHtml || tagsHtml
      ? `<ul class="post-metadata"><li>${dateHtml}</li>${tagsHtml}</ul>`
      : "";

  if (!ui.titleInput.value && !dateHtml && !tagsHtml && !content) {
    ui.previewContent.innerHTML = "";
  } else {
    await sanitizeHTML(
      ui.previewContent,
      `${titleHtml}${metadataHtml}${marked.parse(content)}`,
    );
  }
  if (window.Prism) Prism.highlightAllUnder(ui.previewContent);
}

export { wrapText } from "../utils/text-utils.js";
