# UnifiedAI 后端服务

基于 Node.js + TypeScript + Express + Socket.io + TypeORM + SQLite 的后端服务。

## 功能

- RESTful API
- 实时通信 (Socket.io)
- TypeScript 类型支持
- TypeORM 数据库支持 (SQLite)

## 安装

```bash
# 使用 pnpm 安装依赖
pnpm install
```

## 开发

```bash
# 创建 .env 文件
cp .env.example .env

# 启动开发服务器
pnpm dev
```

## 数据库

项目使用 TypeORM 和 SQLite 数据库：

```bash
# 生成迁移文件
pnpm typeorm migration:generate ./src/migrations/Migration -d ./src/db.ts

# 运行迁移
pnpm typeorm migration:run -d ./src/db.ts

# 回滚迁移
pnpm typeorm migration:revert -d ./src/db.ts
```

## 构建

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 技术栈

- Node.js
- TypeScript
- Express
- Socket.io
- TypeORM
- SQLite
- CORS 