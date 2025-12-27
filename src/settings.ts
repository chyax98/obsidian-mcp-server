import ObsidianMCPServer from "main";
import {
	App,
	PluginSettingTab,
	Setting,
	Notice,
} from "obsidian";

export interface ObsidianMCPServerPluginSettings {
	port: number;
	startOnStartup: boolean;
	tools: {
		// 文件操作
		list_files: boolean;
		read_file: boolean;
		create_file: boolean;
		edit_file: boolean;
		delete_file: boolean;
		create_folder: boolean;
		delete_folder: boolean;
		// Obsidian 原生 API - 基础
		get_active_file: boolean;
		open_file: boolean;
		get_selection: boolean;
		insert_text: boolean;
		get_vault_info: boolean;
		search_vault: boolean;
		// Obsidian 原生 API - MetadataCache
		get_file_metadata: boolean;
		get_links: boolean;
		// Obsidian 原生 API - Workspace
		get_open_files: boolean;
		// Obsidian 原生 API - Commands
		list_commands: boolean;
		execute_command: boolean;
		// Obsidian 原生 API - FileManager
		rename_file: boolean;
	};
}

export const DEFAULT_SETTINGS: ObsidianMCPServerPluginSettings = {
	port: 27123,
	startOnStartup: false,
	tools: {
		// 文件操作
		list_files: true,
		read_file: true,
		create_file: true,
		edit_file: true,
		delete_file: true,
		create_folder: true,
		delete_folder: true,
		// Obsidian 原生 API - 基础
		get_active_file: true,
		open_file: true,
		get_selection: true,
		insert_text: true,
		get_vault_info: true,
		search_vault: true,
		// Obsidian 原生 API - MetadataCache
		get_file_metadata: true,
		get_links: true,
		// Obsidian 原生 API - Workspace
		get_open_files: true,
		// Obsidian 原生 API - Commands
		list_commands: true,
		execute_command: false, // 默认关闭，因为可能有破坏性
		// Obsidian 原生 API - FileManager
		rename_file: true,
	},
};

export class ObsidianMCPServerSettingTab extends PluginSettingTab {
	plugin: ObsidianMCPServer;
	private pendingPort: number | null = null;

	constructor(app: App, plugin: ObsidianMCPServer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// ============ 服务器设置 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.server.heading"))
			.setHeading();

		// 初始化 pendingPort
		this.pendingPort = this.plugin.settings.port;

		new Setting(containerEl)
			.setName(this.plugin.t("settings.port.name"))
			.setDesc(this.plugin.t("settings.port.desc"))
			.addText((text) =>
				text
					.setPlaceholder("27123")
					.setValue(this.plugin.settings.port.toString())
					.onChange((value) => {
						const port = parseInt(value);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.pendingPort = port;
						} else {
							this.pendingPort = null;
						}
					})
			)
			.addButton((button) => {
				button
					.setButtonText("保存并重启")
					.setCta()
					.onClick(async () => {
						if (this.pendingPort && this.pendingPort !== this.plugin.settings.port) {
							this.plugin.settings.port = this.pendingPort;
							await this.plugin.saveSettings();
							try {
								await this.plugin.restartMCPServer();
								new Notice(`端口已切换到 ${this.pendingPort}，服务已重启`);
							} catch (error: any) {
								new Notice(`端口已保存，但重启失败: ${error?.message || error}`);
							}
							this.display();
						} else if (!this.pendingPort) {
							new Notice(this.plugin.t("settings.notices.invalidPort"));
						} else {
							new Notice("端口未变更");
						}
					});
			});

		new Setting(containerEl)
			.setName(this.plugin.t("settings.autoStart.name"))
			.setDesc(this.plugin.t("settings.autoStart.desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.startOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.startOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(this.plugin.t("settings.mcpEndpoint.name"))
			.setDesc(`http://localhost:${this.plugin.settings.port}/mcp`)
			.addButton((button) => {
				button
					.setButtonText(this.plugin.t("settings.buttons.copy"))
					.onClick(() => {
						navigator.clipboard.writeText(
							`http://localhost:${this.plugin.settings.port}/mcp`
						);
						new Notice(
							this.plugin.t("settings.notices.endpointCopied")
						);
					});
			});

		// ============ 配置示例 ============
		new Setting(containerEl)
			.setName("配置示例")
			.setHeading();

		const mcpUrl = `http://localhost:${this.plugin.settings.port}/mcp`;

		// Claude Code CLI 命令
		const cliCommand = `claude mcp add --transport sse -s user obsidian-native ${mcpUrl}`;
		new Setting(containerEl)
			.setName("Claude Code CLI")
			.setDesc("一键添加（推荐）")
			.addButton((button) => {
				button
					.setButtonText("复制")
					.onClick(() => {
						navigator.clipboard.writeText(cliCommand);
						new Notice("CLI 命令已复制");
					});
			});

		// 添加 CLI 代码块
		const cliCodeEl = containerEl.createEl("pre", { cls: "mcp-config-code" });
		cliCodeEl.createEl("code", { text: cliCommand });

		// MCP JSON 配置
		const jsonConfig = JSON.stringify({
			"mcpServers": {
				"obsidian-native": {
					"type": "sse",
					"url": mcpUrl
				}
			}
		}, null, 2);
		new Setting(containerEl)
			.setName("MCP JSON 配置")
			.setDesc("添加到 settings.json 或 claude_desktop_config.json")
			.addButton((button) => {
				button
					.setButtonText("复制")
					.onClick(() => {
						navigator.clipboard.writeText(jsonConfig);
						new Notice("JSON 配置已复制");
					});
			});

		// 添加 JSON 代码块
		const jsonCodeEl = containerEl.createEl("pre", { cls: "mcp-config-code" });
		jsonCodeEl.createEl("code", { text: jsonConfig });

		// ============ 文件操作工具 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.tools.fileOps.heading"))
			.setHeading();

		this.addToolToggle(containerEl, "list_files", "列出目录下的文件和文件夹");
		this.addToolToggle(containerEl, "read_file", "读取文件内容");
		this.addToolToggle(containerEl, "create_file", "创建新文件");
		this.addToolToggle(containerEl, "edit_file", "编辑文件内容");
		this.addToolToggle(containerEl, "delete_file", "删除文件");
		this.addToolToggle(containerEl, "create_folder", "创建文件夹");
		this.addToolToggle(containerEl, "delete_folder", "删除文件夹");

		// ============ Obsidian 原生 API 工具 - 基础 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.tools.nativeApi.heading"))
			.setHeading();

		this.addToolToggle(containerEl, "get_active_file", "获取当前活动文件（可选是否包含内容）");
		this.addToolToggle(containerEl, "open_file", "在编辑器中打开文件");
		this.addToolToggle(containerEl, "get_selection", "获取选中的文本");
		this.addToolToggle(containerEl, "insert_text", "在光标处插入文本");
		this.addToolToggle(containerEl, "get_vault_info", "获取 Vault 信息");
		this.addToolToggle(containerEl, "search_vault", "按文件名搜索");

		// ============ MetadataCache 工具 ============
		new Setting(containerEl)
			.setName("MetadataCache 工具")
			.setHeading();

		this.addToolToggle(containerEl, "get_file_metadata", "获取文件元数据（frontmatter/tags/headings/links）");
		this.addToolToggle(containerEl, "get_links", "获取链接（支持 incoming/outgoing/both）");

		// ============ Workspace 工具 ============
		new Setting(containerEl)
			.setName("Workspace 工具")
			.setHeading();

		this.addToolToggle(containerEl, "get_open_files", "获取所有打开的标签页");

		// ============ Command 工具 ============
		new Setting(containerEl)
			.setName("Command 工具")
			.setHeading();

		this.addToolToggle(containerEl, "list_commands", "列出所有可用命令");
		this.addToolToggle(containerEl, "execute_command", "⚠️ 执行命令（可能有破坏性，默认关闭）");

		// ============ FileManager 工具 ============
		new Setting(containerEl)
			.setName("FileManager 工具")
			.setHeading();

		this.addToolToggle(containerEl, "rename_file", "⚠️ 重命名文件（自动更新所有链接）");

		// ============ 重启提示 ============
		new Setting(containerEl)
			.setDesc(this.plugin.t("settings.buttons.restartHint"))
			.addButton((button) => {
				button
					.setButtonText(this.plugin.t("settings.buttons.restartMCPServer"))
					.onClick(async () => {
						try {
							await this.plugin.restartMCPServer();
							new Notice(this.plugin.t("settings.notices.restartSuccess"));
						} catch (error: any) {
							console.error("MCP Server restart error:", error);
							new Notice(
								this.plugin.t("settings.notices.restartError", {
									error: error?.message || String(error),
								})
							);
						}
					});
			});
	}

	private addToolToggle(
		containerEl: HTMLElement,
		toolName: keyof ObsidianMCPServerPluginSettings["tools"],
		description: string
	) {
		new Setting(containerEl)
			.setName(toolName)
			.setDesc(description)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tools[toolName])
					.onChange(async (value) => {
						this.plugin.settings.tools[toolName] = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
