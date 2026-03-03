import { ui } from './ui-elements.js';
import { drafts, createNewDraft, deleteDraft, updateDraftData, performHousekeeping, setCurrentDraftId, saveDrafts } from './draft-manager.js';
import { updatePreview } from './editor-logic.js';
import { handleFiles } from './image-handler.js';
import { initPasteHandler } from './paste-handler.js';
import { generateMarkdown, downloadZIP } from './zip-exporter.js';
import { initTagEditor } from './tag-editor.js';
import { initAIToggle } from './ai-toggle.js';
import { initSettingsFileHandler } from './settings-file-handler.js';
import { initGitHubSync, createPR, loadPostFromGitHub } from './github-integration.js';
import { debounce } from './debounce.js';
import { openAndLoadDraft } from './load-draft.js';
import { saveImage } from './db-storage.js';
import { base64ToBuffer } from './base64-utils.js';
import { customAlert } from './dialog-utils.js';

const debouncedPreview = debounce((id, ui) => {
	updatePreview(id, drafts, ui);
}, 300);

let lastSyncedTitle = '';
const sync = (e) => {
	const id = localStorage.getItem('current-draft-id');
	updateDraftData(id, ui);
	debouncedPreview(id, ui);
	if (ui.titleInput.value !== lastSyncedTitle) {
		renderList();
		lastSyncedTitle = ui.titleInput.value;
	}
};

const tagEditor = initTagEditor(ui, () => sync());

function renderList() {
	ui.draftsListEl.innerHTML = '';
	const currentId = localStorage.getItem('current-draft-id');
	drafts.forEach(d => {
		const li = document.createElement('li'); if (d.id === currentId) li.classList.add('active');
		li.onclick = () => loadDraft(d.id);
		const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'current-draft'; radio.checked = d.id === currentId;
		const title = document.createElement('span'); title.className = 'draft-title'; title.textContent = d.title || 'Untitled Draft';
		const del = document.createElement('button'); del.className = 'delete-draft-btn'; del.textContent = '🗑️';
		del.onclick = (e) => { e.stopPropagation(); deleteDraft(d.id, ui, () => createNewDraft(ui, loadDraft, renderList), loadDraft, renderList); };
		li.append(radio, title, del); ui.draftsListEl.appendChild(li);
	});
}

async function loadDraft(id) {
	const d = drafts.find(draft => draft.id === id); if (!d) return;
	setCurrentDraftId(id);
	ui.titleInput.value = d.title || ''; ui.descInput.value = d.description || '';
	ui.dateInput.value = d.date || ''; ui.tagsInput.value = d.tags || '';
	
	let content = d.content || '';
	let classifierResults = [];
	
	// Try to parse from content
	const match = content.match(/IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \},\s*confidences: (\[.*?\])/) || content.match(/IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \}/);
	if (match) {
		try {
			const parsedIds = JSON.parse(match[1]);
			const parsedConfidences = match[2] ? JSON.parse(match[2]) : [];
			if (parsedIds.length > 0) {
				classifierResults = parsedIds.map((id, i) => ({
					id,
					confidence: parsedConfidences[i] !== undefined ? parsedConfidences[i] : null
				}));
			}
		} catch (e) { console.warn("Failed to parse categories from content", e); }
	}
	
	ui.contentInput.value = content;
	ui.aiWriterInput.value = '';
	lastSyncedTitle = ui.titleInput.value;
	tagEditor.renderPills(); 
	
	if (window.renderClassifierResults) {
		await window.renderClassifierResults(ui, classifierResults, () => sync());
	}
	
	updatePreview(id, drafts, ui); renderList();
}

ui.titleInput.oninput = sync; ui.descInput.oninput = sync; ui.dateInput.oninput = sync; ui.contentInput.oninput = sync;
window.addEventListener('classifier-updated', sync);

ui.newDraftBtn.onclick = async () => await createNewDraft(ui, loadDraft, renderList);
ui.loadDraftBtn.onclick = () => openAndLoadDraft(ui, loadDraft, renderList);
ui.copyBtn.onclick = () => {
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	const classifierIds = window.getSelectedClassifierIds ? window.getSelectedClassifierIds() : [];
	const md = generateMarkdown(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value, classifierIds);
	navigator.clipboard.writeText(md).then(() => {
		const oldText = ui.copyBtn.textContent; ui.copyBtn.textContent = '✅ Copied!';
		setTimeout(() => ui.copyBtn.textContent = oldText, 2000);
	}).catch(() => customAlert(ui, 'Failed to copy to clipboard.'));
};
ui.downloadBtn.onclick = async () => {
	await performHousekeeping();
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	const classifierIds = window.getSelectedClassifierIds ? window.getSelectedClassifierIds() : [];
	downloadZIP(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value, classifierIds);
};
ui.githubPrBtn.onclick = async () => {
	await performHousekeeping();
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	createPR(ui, d);
};

initPasteHandler(ui, drafts, tagEditor, sync);

ui.uploadBtn.onclick = () => ui.fileInput.click();
ui.fileInput.onchange = () => handleFiles(ui.fileInput.files, localStorage.getItem('current-draft-id'), drafts, ui, sync);

(async () => {
	initGitHubSync(ui);
	
	const editPath = new URLSearchParams(window.location.search).get('edit');
	if (editPath) {
		try {
			const postData = await loadPostFromGitHub(ui, editPath);
			const existingDraft = drafts.find(d => d.path === postData.path);
			const id = existingDraft ? existingDraft.id : Date.now().toString();
			
			const imageFiles = [];
			for (const img of postData.images || []) {
				const buffer = base64ToBuffer(img.content);
				const imgId = `${id}:${Date.now()}:${img.name}`;
				await saveImage(imgId, buffer);
				imageFiles.push({ name: img.name, id: imgId, type: `image/${img.name.split('.').pop()}`, sha: img.sha, path: img.path });
			}
			
			if (existingDraft) {
				existingDraft.title = postData.title || '';
				existingDraft.description = postData.description || '';
				existingDraft.date = postData.date || '';
				existingDraft.tags = postData.tags || '';
				existingDraft.content = postData.content || '';
				existingDraft.imageFiles = imageFiles;
				existingDraft.sha = postData.sha;
				existingDraft.lastModified = Date.now();
			} else {
				const newDraft = {
					id,
					title: postData.title || '',
					description: postData.description || '',
					date: postData.date || '',
					tags: postData.tags || '',
					content: postData.content || '',
					imageFiles,
					path: postData.path,
					sha: postData.sha,
					lastModified: Date.now()
				};
				drafts.unshift(newDraft);
			}
			setCurrentDraftId(id);
			saveDrafts();
			
			// Remove edit param from URL
			const url = new URL(window.location);
			url.searchParams.delete('edit');
			window.history.replaceState({}, '', url);
		} catch (e) {
			console.error(e);
			// Fallback if GitHub load fails or settings are missing
			if (e.message.includes('fill in GitHub settings')) {
				ui.settingsDetails.open = true;
				ui.ghTokenInput.focus();
			} else {
				customAlert(ui, `Failed to load post: ${e.message}`);
			}
		}
	}

	if (drafts.length === 0) await createNewDraft(ui, loadDraft, renderList);
	else await loadDraft(localStorage.getItem('current-draft-id') || drafts[0].id);
	
	initAIToggle(ui);
	initSettingsFileHandler(ui);
	if (ui.aiFeaturesToggle.checked) {
		const { initAIFeatures } = await import('./ai-init.js');
		await initAIFeatures(ui, sync, tagEditor);
	}
	await performHousekeeping();
})();
export { loadDraft, renderList, sync, tagEditor };
