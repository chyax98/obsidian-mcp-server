#!/usr/bin/env node
import { execSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DEFAULT_VAULT = join(process.env.HOME, "note-vsc");
const PLUGIN_PATH = ".obsidian/plugins/obsidian-mcp-native";

const vault = process.argv[2] || DEFAULT_VAULT;
const target = join(vault, PLUGIN_PATH);

// 构建
console.log("Building...");
execSync("npm run build", { stdio: "inherit" });

// 确保目标目录存在
if (!existsSync(target)) {
	mkdirSync(target, { recursive: true });
	console.log(`Created directory: ${target}`);
}

// 复制文件
const files = ["main.js", "manifest.json", "styles.css"];
for (const file of files) {
	copyFileSync(file, join(target, file));
}

console.log(`Deployed to: ${target}`);
