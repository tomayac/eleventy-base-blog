import {
  processImage,
  getMarkdownForImage,
  handleFiles,
} from "./image-handler.js";
import {
  parseFrontmatter,
  populateUIFromMetadata,
} from "./frontmatter-parser.js";

export function initPasteHandler(ui, drafts, tagEditor, sync) {
  ui.contentInput.onpaste = async (e) => {
    if (e.clipboardData.files?.length > 0) {
      e.preventDefault();
      return handleFiles(
        e.clipboardData.files,
        localStorage.getItem("current-draft-id"),
        drafts,
        ui,
        sync,
      );
    }
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      const id = localStorage.getItem("current-draft-id"),
        draft = drafts.find((d) => d.id === id);
      const turndownService = new TurndownService({
        headingStyle: "atx",
        bullet: "*",
      });
      turndownService.addRule("figureImages", {
        filter: "img",
        replacement: (content, node) => {
          const src = node.getAttribute("src"),
            alt = node.getAttribute("alt") || "";
          if (src?.startsWith("__PASTED_IMG_")) return src;
          return `<figure>\n  <img src="${src}" alt="${alt}" loading="lazy" decoding="async">\n  <figcaption>\n    ${alt}\n  </figcaption>\n</figure>`;
        },
      });
      const doc = new DOMParser().parseFromString(html, "text/html"),
        imageMap = new Map();
      doc.querySelectorAll("img").forEach((img, i) => {
        const src = img.getAttribute("src");
        if (src) {
          const p = `__PASTED_IMG_${i}__`;
          imageMap.set(p, src);
          img.setAttribute("src", p);
        }
      });
      let markdown = turndownService.turndown(doc.body.innerHTML);
      const start = ui.contentInput.selectionStart,
        end = ui.contentInput.selectionEnd;
      const val = ui.contentInput.value,
        before = val.substring(0, start).replace(/\n+$/, ""),
        after = val.substring(end).replace(/^\n+/, "");
      let i = 0;
      for (const [p, src] of imageMap) {
        try {
          const resp = await fetch(src),
            blob = await resp.blob();
          let name = src.split("/").pop().split("?")[0] || `pasted-image.png`;
          if (name === "image.png" || !name.includes("."))
            name = `pasted-image-${Date.now()}-${i++}.png`;
          const info = await processImage(
            new File([blob], name, { type: blob.type }),
            id,
            draft,
            ui,
          );
          markdown = markdown.replaceAll(
            p,
            getMarkdownForImage(info, false, false),
          );
        } catch (err) {
          markdown = markdown.replaceAll(
            p,
            `<figure>\n  <img src="${src}" alt="" loading="lazy" decoding="async">\n  <figcaption>Pasted Image</figcaption>\n</figure>`,
          );
        }
      }
      markdown = markdown.trim();
      ui.contentInput.value =
        before +
        (before.length > 0 ? "\n\n" : "") +
        markdown +
        (after.length > 0 ? "\n\n" : "") +
        after;
      return sync();
    }
    const { metadata, content } = parseFrontmatter(
      e.clipboardData.getData("text"),
    );
    if (metadata && Object.keys(metadata).length > 0) {
      e.preventDefault();
      populateUIFromMetadata(metadata, ui, tagEditor);
      ui.contentInput.value = content;
      sync();
    }
  };
  let dragCounter = 0;
  const isFiles = (e) => e.dataTransfer.types.includes("Files");
  window.addEventListener("dragenter", (e) => {
    if (ui.dropZone.getAttribute("data-disabled") !== "true" && isFiles(e)) {
      dragCounter++;
      ui.dropZone.classList.add("dragover");
    }
  });
  window.addEventListener("dragleave", () => {
    if (ui.dropZone.getAttribute("data-disabled") !== "true") {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) ui.dropZone.classList.remove("dragover");
    }
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    if (ui.dropZone.getAttribute("data-disabled") === "true") return;
    e.preventDefault();
    dragCounter = 0;
    ui.dropZone.classList.remove("dragover");
    if (e.dataTransfer.files?.length > 0)
      handleFiles(
        e.dataTransfer.files,
        localStorage.getItem("current-draft-id"),
        drafts,
        ui,
        sync,
      );
  });
}
