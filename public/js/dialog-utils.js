export async function customAlert(ui, message) {
  ui.alertMessage.textContent = message;
  ui.alertDialog.showModal();
  return new Promise((resolve) => {
    ui.alertDialog.addEventListener("close", () => resolve(), { once: true });
  });
}

export async function customConfirm(ui, message, options = {}) {
  ui.confirmMessage.textContent = message;
  const confirmBtn = ui.confirmDialog.querySelector('button[value="confirm"]');
  const cancelBtn = ui.confirmDialog.querySelector('button[value="cancel"]');

  const originalConfirmText = confirmBtn.textContent;
  const originalCancelText = cancelBtn.textContent;

  if (options.confirmText) confirmBtn.textContent = options.confirmText;
  if (options.cancelText) cancelBtn.textContent = options.cancelText;

  ui.confirmDialog.showModal();
  return new Promise((resolve) => {
    ui.confirmDialog.addEventListener(
      "close",
      () => {
        const result = ui.confirmDialog.returnValue;
        confirmBtn.textContent = originalConfirmText;
        cancelBtn.textContent = originalCancelText;
        resolve(result);
      },
      { once: true },
    );
  });
}
