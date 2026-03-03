export function wrapText(text, limit) {
  const words = text.split(" ");
  let lines = [];
  let currentLine = "";
  words.forEach((word) => {
    if ((currentLine + word).length > limit) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });
  lines.push(currentLine.trim());
  return lines.join("\n    ");
}
