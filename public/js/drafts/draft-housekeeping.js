import { cleanupOrphanedImages } from "../utils/db-storage.js";

export async function performHousekeeping(drafts, saveDraftsFn) {
  const allValidImageIds = [];
  drafts.forEach((draft) => {
    if (!draft.imageFiles || !draft.content) return;
    // Filter imageFiles to only those actually referenced in the content string
    draft.imageFiles = draft.imageFiles.filter((img) => {
      const isReferenced = draft.content.includes(`./${img.name}`);
      if (isReferenced) allValidImageIds.push(img.id);
      return isReferenced;
    });
  });
  saveDraftsFn();
  await cleanupOrphanedImages(allValidImageIds);
}
