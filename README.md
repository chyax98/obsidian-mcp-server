# Obsidian MCP Native

轻量级 Obsidian MCP 服务器插件，专注于提供 Obsidian 原生 API 访问能力。

## 特点

- 轻量级设计，不影响 Obsidian 启动速度
- 提供 Obsidian 原生 API 访问（当前文档、选中内容、工作区状态等）
- 支持 MCP Streamable HTTP 协议

## 功能

### 文件操作工具
| 工具名 | 功能 |
|--------|------|
| `list_files` | 列出目录下的文件和文件夹 |
| `read_file` | 读取文件内容 |
| `create_file` | 创建新文件 |
| `edit_file` | 编辑文件指定行 |
| `delete_file` | 删除文件 |
| `create_folder` | 创建文件夹 |
| `delete_folder` | 删除文件夹 |

### Obsidian 原生 API 工具
| 工具名 | 功能 |
|--------|------|
| `get_active_file` | 获取当前活动文件（含内容） |
| `get_active_file_path` | 获取当前活动文件路径（轻量） |
| `open_file` | 在编辑器中打开文件 |
| `get_selection` | 获取当前选中的文本 |
| `insert_text` | 在光标位置插入文本 |
| `get_vault_info` | 获取 Vault 信息 |
| `search_vault` | 按文件名搜索 |

## 安装

1. 克隆仓库到 Obsidian 插件目录：
   ```bash
   cd /path/to/vault/.obsidian/plugins/
   git clone https://github.com/chyax98/obsidian-mcp-server.git obsidian-mcp-native
   ```

2. 安装依赖并构建：
   ```bash
   cd obsidian-mcp-native
   npm install
   npm run build
   ```

3. 在 Obsidian 中启用插件

## 使用

1. 启动 MCP 服务器（命令面板 → "Start Server" 或开启自动启动）
2. 连接端点：`http://localhost:27123/mcp`（端口可配置）
3. 在 AI 客户端中配置 MCP Streamable HTTP 连接

### Claude Desktop 配置示例

```json
{
  "mcpServers": {
    "obsidian-native": {
      "type": "streamable-http",
      "url": "http://localhost:27123/mcp"
    }
  }
}
```

## 开发

```bash
npm install
npm run dev   # 开发模式（监听文件变化）
npm run build # 生产构建
```

## License

MIT
