import { updateDraftData } from './draft-manager.js';
import { customAlert } from './dialog-utils.js';
import { getMonitor, runAIAction } from './ai-features.js';
import { refreshAIVisibility } from './ai-toggle.js';

let cachedTaxonomy = null;

async function getTaxonomy() {
	if (cachedTaxonomy) return cachedTaxonomy;
	
	try {
		const TSV_URL = 'https://raw.githubusercontent.com/InteractiveAdvertisingBureau/Taxonomies/develop/Content%20Taxonomies/Content%20Taxonomy%203.1.tsv';
		const response = await fetch(TSV_URL);
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const text = await response.text();

		const lines = text.split('\n');
		const taxonomy = {};

		// Header is on line 1, Data starts on line 2
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			const parts = line.split('\t');
			if (parts.length < 3) continue;

			const id = parts[0].trim();
			const tiers = parts.slice(3, 7).map(t => t.trim()).filter(Boolean);
			const name = tiers.join(' > ');

			if (id && name) {
				taxonomy[id] = name;
			}
		}

		cachedTaxonomy = taxonomy;
		return cachedTaxonomy;
	} catch (e) {
		console.warn("Failed to fetch taxonomy from GitHub, falling back to basic resolution", e);
		return {};
	}
}

export async function initAIClassifier(ui, updateCallback) {
	if (!ui.aiClassifierBtn) return;

	if (!('Classifier' in self)) {
		try {
			await import('/js/task-apis/classifier.js');
		} catch (e) {
			console.error("Failed to load Classifier polyfill", e);
			return;
		}
	}
	const ClassifierClass = self.Classifier;
	
	// Restoration logic: If the editor already has categories, render them immediately
	const content = ui.contentInput.value;
	const match = content.match(/IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \},\s*confidences: (\[.*?\])/) || content.match(/IAB_CONTENT_(?:2_2|3_1): \{ values: (\[.*?\]) \}/);
	if (match) {
		try {
			const ids = JSON.parse(match[1]);
			const confidences = match[2] ? JSON.parse(match[2]) : [];
			if (ids.length > 0) {
				const results = ids.map((id, i) => ({
					id,
					confidence: confidences[i] !== undefined ? confidences[i] : null
				}));
				await renderClassifierResults(ui, results, updateCallback);
			}
		} catch (e) { console.warn("Initial category restoration failed", e); }
	}

	if (ClassifierClass) {
		try {
			const status = await ClassifierClass.availability();
			if (status !== 'unavailable') {
				ui.aiClassifierSection?.setAttribute('data-ai-available', 'true');
				ui.aiClassifierBtn?.setAttribute('data-ai-available', 'true');
				refreshAIVisibility(ui);
			}
		} catch (e) { console.warn("AI Classifier availability check failed", e); }
	}

	window.addEventListener('classifier-updated', () => {
		const id = localStorage.getItem('current-draft-id');
		if (id) {
			updateDraftData(id, ui);
			updateScriptTagInContent(ui);
		}
	});

	if (ui.aiClassifierBtn) {
		ui.aiClassifierBtn.onclick = async () => {
			const title = ui.titleInput.value.trim();
			const content = ui.contentInput.value.trim();
			if (!title && !content) return customAlert(ui, 'Please provide a title or content first.');

			const input = `Title: ${title}\n\nContent: ${content}`;

			await runAIAction(ui, ui.aiClassifierBtn, async () => {
				ui.aiClassifierResults.innerHTML = 'Classifying...';
				const monitor = getMonitor(ui, 'en', 'Classifier');
				const classifier = await ClassifierClass.create({
					...monitor
				});
				const results = await classifier.classify(input);
				
				if (results && results.length > 0) {
					const filteredResults = results.filter(res => res.id !== 'unknown');
					if (filteredResults.length === 0) {
						ui.aiClassifierResults.innerHTML = 'No categories found.';
						return;
					}
					const resultsToRender = filteredResults.map(res => ({ id: res.id, confidence: res.confidence }));
					await renderClassifierResults(ui, resultsToRender, updateCallback);
					window.dispatchEvent(new CustomEvent('classifier-updated'));
				} else {
					ui.aiClassifierResults.innerHTML = 'No categories found.';
				}
			}, updateCallback);
		};
	}
}

export function updateScriptTagInContent(ui) {
	const classifierResults = Array.from(document.querySelectorAll('.classifier-result-row')).map(row => ({
		id: row.getAttribute('data-category-id'),
		confidence: parseFloat(row.querySelector('td:last-child').textContent) / 100
	}));
	let content = ui.contentInput.value.trim();
	
	// Remove existing script tag (handling variations)
	content = content.replace(/\n*<script>[\s\S]*?googletag\.setConfig\(\{[\s\S]*?\}\);[\s\S]*?<\/script>/g, '').trimEnd();

	if (classifierResults.length > 0) {
		const ids = classifierResults.map(r => String(r.id));
		const confidences = classifierResults.map(r => r.confidence);
		const scriptTag = `<script>
  window.googletag = window.googletag || { cmd: [] };
  googletag.setConfig({
    pps: {
      taxonomies: {
        IAB_CONTENT_3_1: { values: ${JSON.stringify(ids)} },
        confidences: ${JSON.stringify(confidences)},
      },
    },
  });
</script>`;
		content = content + '\n\n' + scriptTag;
	}
	
	if (ui.contentInput.value !== content) {
		ui.contentInput.value = content;
		// Trigger sync to update preview and draft
		const event = new Event('input', { bubbles: true });
		ui.contentInput.dispatchEvent(event);
	}
}

export async function renderClassifierResults(ui, results, updateCallback) {
	if (!results || results.length === 0) {
		ui.aiClassifierResults.innerHTML = '';
		return;
	}

	const taxonomy = await getTaxonomy();

	let html = '<table><thead><tr><th>Category</th><th>Confidence</th></tr></thead><tbody>';
	for (const res of results) {
		const categoryName = taxonomy[res.id] || res.id;
		html += `
			<tr class="classifier-result-row" data-category-id="${res.id}">
				<td>
					<span class="tag-pill classifier-pill">
						${categoryName}
						<button type="button" class="remove-tag" title="Remove category" onclick="this.closest('tr').remove(); window.dispatchEvent(new CustomEvent('classifier-updated'))">×</button>
					</span>
				</td>
				<td>${res.confidence ? Math.round(res.confidence * 100) + '%' : '-'}</td>
			</tr>`;
	}
	html += '</tbody></table>';
	ui.aiClassifierResults.innerHTML = html;
}

export function getSelectedClassifierIds() {
	return Array.from(document.querySelectorAll('.classifier-result-row')).map(row => row.getAttribute('data-category-id'));
}

// Global exposure for logic synchronization
window.getSelectedClassifierIds = getSelectedClassifierIds;
window.renderClassifierResults = renderClassifierResults;
