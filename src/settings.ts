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
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(app: App, plugin: ObsidianMCPServer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private debouncedRefresh() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.display();
		}, 500);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// ============ 服务器设置 ============
		new Setting(containerEl)
			.setName(this.plugin.t("settings.server.heading"))
			.setHeading();

		new Setting(containerEl)
			.setName(this.plugin.t("settings.port.name"))
			.setDesc(this.plugin.t("settings.port.desc"))
			.addText((text) =>
				text
					.setPlaceholder("27123")
					.setValue(this.plugin.settings.port.toString())
					.onChange(async (value) => {
						const port = parseInt(value);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.plugin.settings.port = port;
							await this.plugin.saveSettings();
							// 防抖刷新以更新配置示例中的端口
							this.debouncedRefresh();
						} else {
							new Notice(
								this.plugin.t("settings.notices.invalidPort")
							);
						}
					})
			);

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

		// Claude Code CLI 配置
		const cliConfig = `claude --mcp-server-sse-url http://localhost:${this.plugin.settings.port}/mcp`;
		new Setting(containerEl)
			.setName("Claude Code CLI")
			.setDesc("在命令行中使用")
			.addButton((button) => {
				button
					.setButtonText("复制")
					.onClick(() => {
						navigator.clipboard.writeText(cliConfig);
						new Notice("CLI 配置已复制");
					});
			});

		// 添加 CLI 代码块
		const cliCodeEl = containerEl.createEl("pre", { cls: "mcp-config-code" });
		cliCodeEl.createEl("code", { text: cliConfig });

		// MCP Server JSON 配置
		const jsonConfig = JSON.stringify({
			"mcpServers": {
				"obsidian": {
					"url": `http://localhost:${this.plugin.settings.port}/mcp`
				}
			}
		}, null, 2);
		new Setting(containerEl)
			.setName("MCP 客户端配置 (JSON)")
			.setDesc("添加到 claude_desktop_config.json 或其他 MCP 客户端配置")
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

		new Setting(containerEl)
			.addButton((button) => {
				button
					.setButtonText(
						this.plugin.t("settings.buttons.restartMCPServer")
					)
					.onClick(async () => {
						try {
							await this.plugin.restartMCPServer();
							new Notice(
								this.plugin.t("settings.notices.restartSuccess")
							);
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
			.setDesc(this.plugin.t("settings.buttons.restartHint"));
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
