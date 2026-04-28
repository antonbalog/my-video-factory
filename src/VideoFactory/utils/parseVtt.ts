import type { Caption } from "@remotion/captions";

function parseTimestamp(ts: string): number {
  const parts = ts.replace(",", ".").split(":");
  let seconds = 0;
  if (parts.length === 3) {
    seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds = Number(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    seconds = parseFloat(parts[0]);
  }
  return Math.round(seconds * 1000);
}

export function parseVtt(input: string): Caption[] {
  const captions: Caption[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map((s) => s.trim().split(" ")[0]);
      const startMs = parseTimestamp(startStr);
      const endMs = parseTimestamp(endStr);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i++;
      }

      const text = textLines.join(" ").replace(/<[^>]+>/g, "");
      if (text) {
        captions.push({
          text,
          startMs,
          endMs,
          timestampMs: startMs,
          confidence: 1,
        });
      }
    } else {
      i++;
    }
  }

  return captions;
}
