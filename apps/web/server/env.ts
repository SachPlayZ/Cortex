import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadServerEnv(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      if (!key || process.env[key]) continue;
      let value = line.slice(index + 1).trim();
      const quoted = /^(['"])(.*)\1$/.exec(value);
      if (quoted) {
        value = quoted[2] ?? "";
      } else {
        const comment = value.search(/\s#/);
        if (comment !== -1) value = value.slice(0, comment).trimEnd();
      }
      process.env[key] = value;
    }
  }
}
