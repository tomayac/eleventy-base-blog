import { getImage } from './db-storage.js';

function escapeYamlValue(val) {
	if (typeof val !== 'string') return val;
	// Wrap in quotes if it contains YAML-special characters
	if (/[#:[\]{}>|&*?%@`']/.test(val) || val.includes(': ')) {
		return `"${val.replace(/"/g, '\\"')}"`;
	}
	return val;
}

export function generateMarkdown(draft, title, description, date, tagsValue, content) {
	const tags = tagsValue.split(',').map(t => t.trim()).filter(t => t);
	const escapedTags = tags.map(t => `"${t.replace(/"/g, '\\"')}"`);
	const tagsYaml = escapedTags.length > 0 ? `tags: [${escapedTags.join(', ')}]` : 'tags: []';
	
	const frontmatter = [
		'---',
		`title: ${escapeYamlValue(title)}`,
		`description: ${escapeYamlValue(description)}`,
		`date: ${date}`,
		tagsYaml,
		'---',
		''
	].join('\n');
	
	return frontmatter + content;
}

export async function downloadZIP(draft, title, description, date, tagsValue, content) {
	const slug = (title || 'untitled').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
	const md = generateMarkdown(draft, title, description, date, tagsValue, content);
	const files = [{ name: `${slug}/${slug}.md`, content: new TextEncoder().encode(md) }];

	if (draft.imageFiles && draft.imageFiles.length > 0) {
		for (const img of draft.imageFiles) {
			const data = await getImage(img.id);
			if (data) files.push({ name: `${slug}/${img.name}`, content: new Uint8Array(data) });
		}
	}

	const CRC32 = (data) => {
		let crc = 0 ^ -1;
		const crcTable = [];
		for (let i = 0; i < 256; i++) {
			let c = i;
			for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
			crcTable[i] = c;
		}
		for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
		return (crc ^ -1) >>> 0;
	};

	let offset = 0;
	const centralDirectory = [];
	const zipParts = [];

	for (const file of files) {
		const nameBuf = new TextEncoder().encode(file.name);
		const crc = CRC32(file.content);
		const size = file.content.length;
		const header = new Uint8Array(30 + nameBuf.length);
		const view = new DataView(header.buffer);
		view.setUint32(0, 0x04034b50, true); view.setUint16(4, 10, true);
		view.setUint16(6, 0, true); view.setUint16(8, 0, true);
		view.setUint16(10, 0, true); view.setUint16(12, 0, true);
		view.setUint32(14, crc, true); view.setUint32(18, size, true);
		view.setUint32(22, size, true); view.setUint16(26, nameBuf.length, true);
		view.setUint16(28, 0, true); header.set(nameBuf, 30);
		zipParts.push(header, file.content);

		const dirHeader = new Uint8Array(46 + nameBuf.length);
		const dirView = new DataView(dirHeader.buffer);
		dirView.setUint32(0, 0x02014b50, true); dirView.setUint16(4, 10, true);
		dirView.setUint16(6, 10, true); dirView.setUint16(10, 0, true);
		dirView.setUint32(16, crc, true); dirView.setUint32(20, size, true);
		dirView.setUint32(24, size, true); dirView.setUint16(28, nameBuf.length, true);
		dirView.setUint32(42, offset, true); dirHeader.set(nameBuf, 46);
		centralDirectory.push(dirHeader);
		offset += header.length + size;
	}

	const eocd = new Uint8Array(22);
	const eocdView = new DataView(eocd.buffer);
	eocdView.setUint32(0, 0x06054b50, true); eocdView.setUint16(8, files.length, true);
	eocdView.setUint16(10, files.length, true);
	eocdView.setUint32(12, centralDirectory.reduce((a, b) => a + b.length, 0), true);
	eocdView.setUint32(16, offset, true);

	const url = URL.createObjectURL(new Blob([...zipParts, ...centralDirectory, eocd], { type: 'application/zip' }));
	const a = document.createElement('a'); a.href = url; a.download = `${slug}.zip`; a.click();
	URL.revokeObjectURL(url);
}
