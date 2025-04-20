# Node.js TypeScript Socket.IO 示例

这是一个 Node.js TypeScript 应用程序，集成了 Express 和 Socket.IO，实现了实时聊天功能。

## 功能特点

- 使用 TypeScript 强类型
- Express 服务器
- Socket.IO 实时通信
- 聊天室和私聊功能
- 房间管理
- dotenv 环境变量配置

## 安装

```bash
# 安装依赖
pnpm install
```

## 运行

```bash
# 开发模式运行
pnpm dev

# 构建
pnpm build

# 生产模式运行
pnpm start
```

## 使用

1. 启动服务器后，访问 `http://localhost:3000` 打开聊天示例页面
2. 输入房间 ID 并点击"加入房间"按钮加入聊天室
3. 在消息框中输入内容并发送
4. 可以打开多个浏览器窗口测试多用户聊天

## API 接口

### REST API

- `GET /api` - 欢迎信息
- `POST /api/broadcast` - 广播消息到所有连接的客户端
  - 请求体: `{ "event": "事件名", "data": "消息内容" }`

### Socket.IO 事件

#### 客户端发送事件

- `chat:message` - 发送聊天消息
  - 数据: `{ text: "消息内容", roomId: "房间ID" }`
- `room:join` - 加入房间
  - 数据: `"房间ID"`
- `room:leave` - 离开房间
  - 数据: `"房间ID"`

#### 服务器发送事件

- `chat:message` - 接收聊天消息
  - 数据: `{ userId: "用户ID", text: "消息内容", timestamp: "时间戳" }`
- `room:userJoined` - 用户加入房间通知
  - 数据: `{ userId: "用户ID", roomId: "房间ID", timestamp: "时间戳" }`
- `room:userLeft` - 用户离开房间通知
  - 数据: `{ userId: "用户ID", roomId: "房间ID", timestamp: "时间戳" }`

## 目录结构

```
.
├── public/              # 静态文件
│   └── index.html       # 客户端示例
├── src/
│   ├── index.ts         # 主程序入口
│   └── services/
│       └── socketService.ts  # Socket.IO 封装服务
├── .env                 # 环境变量
├── package.json
└── tsconfig.json
```

## 扩展开发

Socket.IO 服务被封装在 `src/services/socketService.ts` 文件中，你可以：

1. 添加新的事件处理
2. 扩展消息类型
3. 添加用户认证
4. 实现消息存储和历史记录

## 许可证

MIT
