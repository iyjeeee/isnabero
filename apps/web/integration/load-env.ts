import fs from "node:fs";
import path from "node:path";

// readText: decodes UTF-8 (with or without BOM) and UTF-16 (what PowerShell redirection writes)
function readText(file: string): string {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le").replace(/^\uFEFF/, "");
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

export const ENV_FILES_FOUND: string[] = []; // shown in the harness error so a misnamed file is easy to spot

// load-env: reads apps/web/.env.integration (wins) then .env.local. Real environment variables win over both files.
for (const name of [".env.integration", ".env.local"]) {
  const file = path.resolve(__dirname, "..", name);
  if (!fs.existsSync(file)) continue;
  ENV_FILES_FOUND.push(name);
  for (const line of readText(file).split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trimStart().startsWith("#") && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
}
