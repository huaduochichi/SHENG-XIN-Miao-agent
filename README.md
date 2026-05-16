# 省心喵 SHENG XIN Miao

省心喵是一个面向大学生的 AI 理财陪伴型产品 Demo。它围绕「记账、预算、攒钱目标、风险学习」四个校园理财场景，提供轻量、可爱、可交互的 AI 助手体验。

SHENG XIN Miao is an AI-powered financial companion demo designed for college students. It focuses on four common campus finance scenarios: expense tracking, budgeting, saving goals, and financial risk learning.

## 项目简介 | Overview

省心喵希望帮助大学生更轻松地管理生活费、记录消费、制定攒钱计划，并在面对理财产品或收益承诺时具备基础判断能力。

SHENG XIN Miao helps college students manage living expenses, record daily spending, build saving plans, and understand financial risks in a simple and friendly way.

## 核心功能 | Core Features

### 1. AI 记账 | AI Expense Tracking

用户可以用自然语言输入消费内容，例如：

Users can record expenses in natural language, for example:

```text
今天午饭 26，奶茶 18，地铁 6 元
```

省心喵会自动识别金额、分类账单，并生成消费复盘。

SHENG XIN Miao automatically extracts amounts, categorizes records, and generates spending feedback.

### 2. 生活费预算 | Living Expense Budgeting

用户可以输入生活费、固定支出、想存的钱、周期天数以及 buffer 金额。

Users can enter their living allowance, fixed costs, saving amount, budget period, and buffer amounts.

系统会生成：

The system generates:

- 每日建议可花金额 | Suggested daily spending
- 每周预算 | Weekly budget
- 快乐 buffer 与应急 buffer | Fun buffer and emergency buffer
- 分类预算建议 | Category-level budget suggestions

### 3. 攒钱目标 | Saving Goal Planning

用户可以设置：

Users can define:

- 想攒钱做什么 | What they are saving for
- 目标金额 | Target amount
- 当前已攒金额 | Current savings
- 计划周期 | Time period

省心喵会生成每日或每周攒钱计划、阶段里程碑和补救建议。

The assistant generates daily or weekly saving plans, milestones, and recovery suggestions if the user falls behind.

### 4. 风险学习 | Financial Risk Learning

风险模块包含财经知识学习和风险识别能力。

The risk module supports financial knowledge learning and risk detection.

用户可以点击知识卡片快速学习：

Users can tap learning cards such as:

- 年化收益 | Annualized return
- 保本陷阱 | Guaranteed-return traps
- 基金入门 | Fund basics
- 校园贷风险 | Campus loan risks

也可以输入理财产品描述，让 AI 判断潜在风险。

Users can also paste financial product descriptions and ask the AI to identify possible risks.

## 产品体验 | User Experience

- 首页提供轻 3D 猫猫互动形象
- 通过成长值 XP 和今日待办增强陪伴感
- 底部固定导航，适合移动端扫码展示
- 四个功能区均支持真实 AI 对话
- 未设置预算时不展示虚假金额，避免误导用户

- The home page features a lightweight 3D interactive cat mascot
- XP and daily tasks create a sense of companionship
- Bottom navigation is optimized for mobile QR-code demos
- All four feature sections support real AI interaction
- No fake budget numbers are shown before user input

## 技术栈 | Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- DeepSeek API
- Vercel Deployment

## 项目结构 | Project Structure

```text
demo/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
├── server.js
├── package.json
├── .env.example
└── README.md
```

## 本地运行 | Local Development

进入 demo 目录：

Go to the demo directory:

```bash
cd demo
```

复制环境变量示例：

Copy the environment variable template:

```bash
cp .env.example .env
```

在 `.env` 中配置 DeepSeek API Key：

Configure your DeepSeek API key in `.env`:

```bash
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=3000
HOST=127.0.0.1
```

启动本地服务：

Start the local server:

```bash
npm run dev
```

打开浏览器访问：

Open in browser:

```text
http://127.0.0.1:3000
```

## 部署说明 | Deployment

推荐部署到 Vercel。

Recommended deployment platform: Vercel.

在 Vercel 导入 GitHub 仓库时：

When importing the GitHub repository into Vercel:

- Root Directory: `demo`
- Framework Preset: `Other`
- Build Command: 留空 / Leave empty
- Output Directory: 留空 / Leave empty

在 Vercel Environment Variables 中配置：

Set the following environment variables in Vercel:

```bash
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
AI_PROVIDER=deepseek
```

请勿上传 `.env` 文件到 GitHub。

Do not upload the `.env` file to GitHub.

## 展示方式 | Demo Presentation

该项目适合通过 Vercel 生成线上地址后制作二维码，用于移动端扫码体验。

This project is suitable for QR-code-based mobile demos after being deployed to Vercel.

## 安全说明 | Security Notice

本项目不会将用户输入保存到数据库。当前 Demo 使用内存态 session，仅用于演示交互流程。

The demo does not store user input in a database. It uses in-memory session state only for demonstration purposes.

API Key 应通过环境变量配置，不应写入前端代码或提交到 GitHub。

API keys should be configured through environment variables and must not be exposed in frontend code or committed to GitHub.

## 项目定位 | Product Positioning

省心喵不是投资建议工具，而是面向大学生的校园理财陪伴助手，重点在于帮助用户建立预算意识、记录消费、规划目标和识别风险。

SHENG XIN Miao is not an investment advisory tool. It is a campus finance companion for college students, helping users build budgeting awareness, track expenses, plan saving goals, and recognize financial risks.

## License

For competition demo and educational use.
