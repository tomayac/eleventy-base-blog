import { fileSave } from "browser-fs-access";
import { getImage } from "../utils/db-storage.js";

function escapeYamlValue(val) {
  if (typeof val !== "string") return val;
  // Wrap in quotes if it contains YAML-special characters
  if (/[#:[\]{}>|&*?%@`']/.test(val) || val.includes(": ")) {
    return `"${val.replace(/"/g, '\\"')}"`;
  }
  return val;
}

export function generateMarkdown(
  draft,
  title,
  description,
  date,
  tagsValue,
  content,
  classifierResults = [],
) {
  const tags = tagsValue
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);
  const escapedTags = tags.map((t) => `"${t.replace(/"/g, '\\"')}"`);
  const tagsYaml =
    escapedTags.length > 0 ? `tags: [${escapedTags.join(", ")}]` : "tags: []";

  const classifierIds = classifierResults.map((r) => r.id);
  const classifierConfidences = classifierResults.map((r) => r.confidence);

  const frontmatter = [
    "---",
    `title: ${escapeYamlValue(title)}`,
    `description: ${escapeYamlValue(description)}`,
    `date: ${date}`,
    tagsYaml,
    classifierIds.length > 0
      ? `ad_categories: ${JSON.stringify(classifierIds)}`
      : "",
    classifierConfidences.length > 0
      ? `ad_confidences: ${JSON.stringify(classifierConfidences)}`
      : "",
    "---",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return frontmatter + "\n\n" + content;
}

export async function downloadZIP(
  draft,
  title,
  description,
  date,
  tagsValue,
  content,
  classifierResults = [],
) {
  if (!draft) {
    throw new Error("No draft data provided for ZIP export.");
  }
  const slug = (title || "untitled")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
  const md = generateMarkdown(
    draft,
    title,
    description,
    date,
    tagsValue,
    content,
    classifierResults,
  );

  const zip = new JSZip();
  const folder = zip.folder(slug);

  folder.file(`${slug}.md`, md);

  if (draft.imageFiles && draft.imageFiles.length > 0) {
    for (const img of draft.imageFiles) {
      const data = await getImage(img.id);
      if (data) {
        folder.file(img.name, data);
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  await fileSave(blob, {
    fileName: `${slug}.zip`,
    extensions: [".zip"],
    description: "Blog ZIP Archive",
  });
}
