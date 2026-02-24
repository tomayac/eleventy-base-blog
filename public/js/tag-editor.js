export function initTagEditor(ui, onUpdate) {
	const renderPills = () => {
		ui.tagPills.innerHTML = '';
		const tags = ui.tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
		tags.forEach(tag => {
			const pill = document.createElement('div');
			pill.className = 'tag-pill';
			pill.textContent = tag;
			const removeBtn = document.createElement('button');
			removeBtn.className = 'remove-tag';
			removeBtn.innerHTML = '&times;';
			removeBtn.onclick = () => {
				const newTags = tags.filter(t => t !== tag);
				ui.tagsInput.value = newTags.join(', ');
				renderPills();
				onUpdate();
			};
			pill.appendChild(removeBtn);
			ui.tagPills.appendChild(pill);
		});
	};

	ui.tagInput.onkeydown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			const val = ui.tagInput.value.trim().replace(/,/g, '');
			if (val) {
				const tags = ui.tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
				if (!tags.includes(val)) {
					tags.push(val);
					ui.tagsInput.value = tags.join(', ');
					renderPills();
					onUpdate();
				}
				ui.tagInput.value = '';
			}
		}
	};

	return {
		renderPills,
		setTags: (tagsString) => {
			ui.tagsInput.value = tagsString;
			renderPills();
		}
	};
}
