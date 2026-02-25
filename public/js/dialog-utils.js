export async function customAlert(ui, message) {
	ui.alertMessage.textContent = message;
	ui.alertDialog.showModal();
	return new Promise(resolve => {
		ui.alertDialog.addEventListener('close', () => resolve(), { once: true });
	});
}

export async function customConfirm(ui, message) {
	ui.confirmMessage.textContent = message;
	ui.confirmDialog.showModal();
	return new Promise(resolve => {
		ui.confirmDialog.addEventListener('close', () => {
			resolve(ui.confirmDialog.returnValue === 'confirm');
		}, { once: true });
	});
}
