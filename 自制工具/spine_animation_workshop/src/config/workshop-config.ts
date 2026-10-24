import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import type { TransferConfig } from "../core/contracts.ts";
import { validateConfig } from "./validate-config.ts";

export { validateConfig } from "./validate-config.ts";

export function saveConfig(file: string, config: TransferConfig): void {
  validateConfig(config);
  const directory = dirname(file);
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.${randomUUID()}.spw-tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw new Error(`无法保存校准配置：${file}`, { cause: error });
  }
}

export function loadConfig(file: string): TransferConfig {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`找不到或无法读取配置文件：${file}`, { cause: error });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`配置文件不是有效 JSON：${file}`, { cause: error });
  }
  return validateConfig(parsed);
}
