import { deleteImagesForDraft, cleanupOrphanedImages, dbPromise } from './db-storage.js';
import { customConfirm } from './dialog-utils.js';

export let drafts = JSON.parse(localStorage.getItem('blog-drafts') || '[]');
export let currentDraftId = localStorage.getItem('current-draft-id');

export function saveDrafts() {
	localStorage.setItem('blog-drafts', JSON.stringify(drafts));
}

export function createNewDraft(ui, loadDraftFn, renderListFn) {
	const id = Date.now().toString();
	const newDraft = {
		id, title: '', description: '', date: new Date().toISOString().split('T')[0],
		tags: '', content: '', imageFiles: [], lastModified: Date.now()
	};
	drafts.unshift(newDraft);
	currentDraftId = id;
	localStorage.setItem('current-draft-id', id);
	saveDrafts();
	loadDraftFn(id);
	renderListFn();
}

export async function deleteDraft(id, ui, createNewDraftFn, loadDraftFn, renderListFn) {
	const confirmed = await customConfirm(ui, 'Are you sure you want to delete this draft?');
	if (!confirmed) return;
	await deleteImagesForDraft(id);
	drafts = drafts.filter(d => d.id !== id);
	saveDrafts();
	await cleanupOrphanedImages(drafts.map(d => d.id));
	if (currentDraftId === id) {
		if (drafts.length > 0) loadDraftFn(drafts[0].id);
		else createNewDraftFn();
	} else {
		renderListFn();
	}
}

export async function resetApplication(ui) {
	const confirmed = await customConfirm(ui, 'CRITICAL: This will delete ALL drafts, images, and settings. This cannot be undone. Proceed?');
	if (!confirmed) return;
	
	localStorage.clear();
	const db = await dbPromise;
	const tx = db.transaction('images', 'readwrite');
	tx.objectStore('images').clear();
	tx.oncomplete = () => window.location.reload();
}

export function updateDraftData(id, ui) {
	const draft = drafts.find(d => d.id === id);
	if (!draft) return;
	draft.title = ui.titleInput.value;
	draft.description = ui.descInput.value;
	draft.date = ui.dateInput.value;
	draft.tags = ui.tagsInput.value;
	draft.content = ui.contentInput.value;
	draft.lastModified = Date.now();
	saveDrafts();
}
