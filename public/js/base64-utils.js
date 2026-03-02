export function toBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

export function fromBase64(base64) {
	return decodeURIComponent(escape(atob(base64.replace(/\s/g, ''))));
}

export async function bufferToBase64(buffer) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result.split(',')[1]);
		reader.readAsDataURL(new Blob([buffer]));
	});
}

export function base64ToBuffer(base64) {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}
