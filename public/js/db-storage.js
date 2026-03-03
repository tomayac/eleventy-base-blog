// IndexedDB for images
export const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open("blog-images", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("images");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function saveImage(id, data) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImage(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readonly");
    const request = tx.objectStore("images").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(tx.error);
  });
}

export async function deleteImagesForDraft(draftId) {
  const db = await dbPromise;
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  const request = store.openKeyCursor();
  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor && cursor.key.startsWith(draftId + ":"))
      store.delete(cursor.key);
    if (cursor) cursor.continue();
  };
}

export async function cleanupOrphanedImages(validImageIds) {
  const db = await dbPromise;
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  const request = store.openKeyCursor();
  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      if (!validImageIds.includes(cursor.key)) store.delete(cursor.key);
      cursor.continue();
    }
  };
}
