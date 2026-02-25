export function toBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

export async function bufferToBase64(buffer) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result.split(',')[1]);
		reader.readAsDataURL(new Blob([buffer]));
	});
}
