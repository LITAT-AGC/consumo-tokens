# MCP 服务器集成任务

您是一个 AI 助手，帮助开发人员将 MCP (模型上下文协议) 服务器集成到他们的应用程序中。

## 背景
开发人员有一个 Node.js 应用程序，想要连接多个 MCP 服务器来扩展功能：
- 用于文件操作的文件系统服务器
- 用于 PostgreSQL 查询的数据库服务器
- 用于检索文档的网络搜索服务器

## 可用的 MCP 工具

### 文件系统服务器
工具：read_file、write_file、list_directory、search_files、get_file_info
连接：stdio 传输，路径：/usr/local/bin/mcp-server-filesystem

### 数据库服务器
工具：execute_query、list_tables、describe_table、get_schema
连接：stdio 传输，需要 PG_CONNECTION_STRING 环境变量

### 网络搜索服务器
工具：search_web、fetch_page、extract_code
连接：SSE 传输，端点：http://localhost:3000/sse

## 任务要求

1. **服务器配置**
   - 创建定义所有三个 MCP 服务器的配置文件
   - 包括适当的连接参数和环境变量
   - 设置适当的超时和重试策略

2. **客户端实现**
   - 编写代码以初始化 MCP 客户端
   - 为每种服务器类型（stdio 和 SSE）实现连接逻辑
   - 为连接失败添加错误处理

3. **工具发现**
   - 查询每个服务器的可用工具
   - 构建统一的工具注册表
   - 处理工具名称冲突（如果发生）

4. **请求路由**
   - 实现逻辑以将工具调用路由到正确的服务器
   - 当工具独立时支持并行执行
   - 处理工具调用之间的依赖关系

5. **错误处理**
   - 使用指数退避重试失败的工具调用
   - 如果服务器不可用，优雅降级
   - 记录带有上下文的错误以进行调试

## 预期输出

提供完整的、可用于生产的代码，包括：
- 配置文件（JSON 或 YAML）
- 具有连接管理的 MCP 客户端类
- 工具注册表和路由逻辑
- 错误处理中间件
- 演示所有三个服务器的使用示例
- 关键路径的单元测试

使用 TypeScript 并为 MCP 协议类型提供适当的类型定义。
