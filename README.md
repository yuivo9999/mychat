# OmniChat Local AI - 本地化优先多模型 AI 聊天客户端

本地化优先的高级多模型 AI 聊天客户端，支持多分组、多Key、多模态附件与完全本地存储。

## 🚀 GitHub Pages 自动部署指南

本项目已配置通用的 **GitHub Actions** 自动部署工作流（位于 `.github/workflows/deploy.yml`）。当您将代码推送至 GitHub 后，即可通过以下简单步骤开启免费的 GitHub Pages 部署：

### 1. 开启 GitHub Pages 源设置
1. 打开您的 GitHub 仓库页面；
2. 进入 **Settings (设置)** -> **Pages**；
3. 在 **Build and deployment** 下的 **Source (源)** 选择 **`GitHub Actions`**。

### 2. 自动触发构建与部署
每次向 `main` 或 `master` 分支提交/推送代码时，GitHub Actions 会自动：
- 安装依赖并运行 `npm run build`；
- 构建生成 `./dist` 静态网页目录；
- 生成 `404.html` 路由退回保障；
- 自动部署至 GitHub Pages 并生成可公开访问的网页链接！

### 3. 本地开发与构建测试

```bash
# 安装依赖
npm install

# 本地启动开发服务器
npm run dev

# 测试打包构建
npm run build
```
