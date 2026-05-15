# 徒步强国京畿十峰挑战赛 数据可视化

[](https://ranking.cpphusky.workers.dev)

通过 Vite 构建，存于 Cloudflare Workers。

## 本地开发

使用 `pnpm dev` 启动 Wrangler Worker 开发服务器，并从 Wrangler 输出的地址访问 `/admin`。不要用 `pnpm dev:vite` 测试管理后台；Vite 只提供静态页面，不会加载 `.dev.vars` 或处理 `/api/*` 路由。
