import { deleteImagesForDraft, cleanupOrphanedImages } from './db-storage.js';
import { customConfirm } from './dialog-utils.js';

export let drafts = JSON.parse(localStorage.getItem('blog-drafts') || '[]');
export let currentDraftId = localStorage.getItem('current-draft-id');

export function saveDrafts() {
	localStorage.setItem('blog-drafts', JSON.stringify(drafts));
}

export function saveCurrentDraft(id, ui) {
	updateDraftData(id, ui);
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

export async function performHousekeeping() {
	const allValidImageIds = [];
	drafts.forEach(draft => {
		if (!draft.imageFiles) return;
		// Find all ./image-name.ext references in the content
		const referencedNames = new Set();
		const matches = draft.content.matchAll(/\.\/([^)\s"'>]+)/g);
		for (const match of matches) {
			referencedNames.add(match[1]);
		}
		// Filter imageFiles to only those referenced in content
		draft.imageFiles = draft.imageFiles.filter(img => referencedNames.has(img.name));
		// Collect IDs for IDB cleanup
		draft.imageFiles.forEach(img => allValidImageIds.push(img.id));
	});
	saveDrafts();
	await cleanupOrphanedImages(allValidImageIds);
}

export async function deleteDraft(id, ui, createNewDraftFn, loadDraftFn, renderListFn) {
	const confirmed = await customConfirm(ui, 'Are you sure you want to delete this draft?');
	if (!confirmed) return;
	await deleteImagesForDraft(id);
	drafts = drafts.filter(d => d.id !== id);
	saveDrafts();
	
	// Comprehensive cleanup
	await performHousekeeping();
	
	if (currentDraftId === id) {
		if (drafts.length > 0) loadDraftFn(drafts[0].id);
		else createNewDraftFn();
	} else {
		renderListFn();
	}
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
