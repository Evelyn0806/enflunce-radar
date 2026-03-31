# En·flunce Radar - 项目 Prompt

## 项目概述

En·flunce Radar 是一个面向 Polymarket/预测市场生态的 KOL 发现与管理平台，支持中英文双语。

**核心价值：**
- 从 X (Twitter) 实时发现相关 KOL
- 全生命周期 CRM 管理
- AI 驱动的角色分析
- 数据驱动的合作决策

**部署地址：** https://enflunce-radar.vercel.app

---

## 技术栈

### 前端
- **框架：** Next.js 16.1.6 (App Router + Turbopack)
- **语言：** TypeScript 5
- **样式：** Tailwind CSS 4
- **状态管理：** React Hooks (useState, useRouter)

### 后端
- **数据库：** Supabase (PostgreSQL)
- **API：** Next.js API Routes (App Router)
- **外部 API：**
  - X (Twitter) API v2 (Bearer Token 认证)
  - Claude API (Anthropic) via 中继服务

### 部署
- **平台：** Vercel
- **环境变量：** 9 个配置项（Supabase, Twitter, Claude）

---

## 核心功能模块

### 1. KOL 发现 (`/discover`)
**功能：**
- 关键词搜索 X 平台 KOL
- 双策略搜索：推文内容 + Bio 描述
- 实时过滤：粉丝数、语区、Tier
- 批量打标：状态标记（待处理/观望/尽快接触/不合作）
- 一键导入到 CRM

**技术实现：**
- 使用 X API v2 的 `tweets/search/recent` 端点
- 最多返回 200 个去重结果（双策略各 100）
- 自动检测：语言、私域社群、Tier 分级

### 2. KOL 名录 (`/kols`)
**功能：**
- 展示所有已导入的 KOL
- 多维度筛选：语区、Tier、状态、标记
- 数据列：头像、Handle、粉丝数、互动率、最近发帖、角色、状态
- 批量操作：刷新数据、删除

**数据字段：**
```typescript
interface Kol {
  id: string
  x_handle: string
  display_name: string
  avatar_url: string
  bio: string
  followers_count: number
  following_count: number
  posts_count: number
  language: Language // zh, en, ko, tr, vi, bilingual
  tier: Tier // A (≥50K), B (≥10K), C
  avg_engagement_rate: number | null
  last_post_at: string | null
  potential_roles: KolRole[] | null
  role_confidence: RoleConfidence | null
  status: KolStatus // pending, watching, negotiating, active, terminated
  status_flag: StatusFlag // none, star, urgent, stop
  created_at: string
}
```

### 3. KOL 详情 (`/kols/[id]`)
**功能：**
- 完整个人信息展示
- AI 角色分析（Claude Haiku）
- 合作历史记录
- 添加新合作

**AI 角色分析：**
- 7 种角色：evangelist, educator, trader, analyst, builder, influencer, ambassador
- 置信度：low, medium, high
- 自动生成摘要和分析笔记

### 4. CRM 合作管理 (`/crm`)
**功能：**
- 所有合作记录列表
- 按状态筛选：进行中、已完成、已取消
- 编辑合作详情
- 删除合作记录

**合作数据：**
```typescript
interface Collaboration {
  id: string
  kol_id: string
  campaign_name: string
  start_date: string
  end_date: string | null
  budget: number | null
  status: 'active' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
}
```

### 5. 批量导入 (`/kols/batch-import`)
**功能：**
- 输入 @handle 列表（逗号或换行分隔）
- 自动从 X API 获取用户信息
- 批量导入到数据库

### 6. 数据刷新
**功能：**
- 批量刷新 KOL 的互动率和最近发帖时间
- 获取最近 10 条推文
- 计算平均互动率：(likes + retweets + replies) / followers * 100

---

## 数据库设计

### 核心表

#### `kols` 表
```sql
CREATE TABLE kols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_handle TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER NOT NULL,
  following_count INTEGER,
  posts_count INTEGER,
  language TEXT NOT NULL,
  tier TEXT NOT NULL,
  avg_engagement_rate NUMERIC,
  last_post_at TIMESTAMPTZ,
  potential_roles TEXT[],
  role_confidence TEXT,
  role_analysis_notes TEXT,
  role_analyzed_at TIMESTAMPTZ,
  ai_summary TEXT,
  ai_summary_updated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  status_flag TEXT NOT NULL DEFAULT 'none',
  notes TEXT,
  competitor_affiliations TEXT[],
  xhunt_rank_zh INTEGER,
  xhunt_rank_en INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `collaborations` 表
```sql
CREATE TABLE collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  budget NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 计算视图

#### `kols_with_computed` 视图
```sql
CREATE VIEW kols_with_computed AS
SELECT
  k.*,
  -- 重新计算 tier（基于最新粉丝数）
  CASE
    WHEN k.followers_count >= 50000 THEN 'A'
    WHEN k.followers_count >= 10000 THEN 'B'
    ELSE 'C'
  END AS computed_tier,
  -- 是否 30 天无发帖
  (k.last_post_at IS NULL OR k.last_post_at < NOW() - INTERVAL '30 days') AS is_silent
FROM kols k;
```

---

## API 端点

### KOL 相关
- `POST /api/discover` - 搜索 KOL
- `GET /api/kols` - 获取 KOL 列表
- `GET /api/kols/[id]` - 获取单个 KOL
- `PATCH /api/kols/[id]` - 更新 KOL
- `DELETE /api/kols/[id]` - 删除 KOL
- `POST /api/kols/import` - 批量导入（从发现结果）
- `POST /api/kols/batch-import` - 批量导入（从 @handle 列表）
- `POST /api/kols/refresh-stats` - 刷新互动率和发帖数据
- `POST /api/kols/[id]/ai-analyze` - AI 角色分析

### 合作相关
- `GET /api/collaborations` - 获取合作列表
- `POST /api/collaborations` - 创建合作
- `PATCH /api/collaborations/[id]` - 更新合作
- `DELETE /api/collaborations/[id]` - 删除合作

---

## 环境变量配置

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SECRET_KEY=sb_secret_xxx

# X (Twitter) API v2
TWITTER_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAAxxx...
TWITTER_ACCESS_TOKEN=1584180099611361280-xxx
TWITTER_ACCESS_TOKEN_SECRET=xxx

# Claude / Anthropic API
ANTHROPIC_API_KEY=sk-xxx
ANTHROPIC_BASE_URL=https://ai.jiexi6.cn

# App
NEXT_PUBLIC_APP_NAME=En·flunce Radar
```

---

## 关键算法

### 1. Tier 计算
```typescript
function computeTier(followers: number): Tier {
  if (followers >= 50000) return 'A'
  if (followers >= 10000) return 'B'
  return 'C'
}
```

### 2. 语言检测
```typescript
function detectLanguage(bio: string): Language {
  const zhChars = bio.match(/[\u4e00-\u9fa5]/g)
  return zhChars && zhChars.length > 10 ? 'zh' : 'en'
}
```

### 3. 私域社群检测
```typescript
function detectCommunity(bio: string): { has: boolean; links: string[] } {
  const keywords = ['telegram', 'discord', 'wechat', 'tg:', 't.me', 'discord.gg']
  const has = keywords.some(k => bio.toLowerCase().includes(k))
  const links = bio.match(/(https?:\/\/[^\s]+|t\.me\/[^\s]+)/g) || []
  return { has, links }
}
```

### 4. 互动率计算
```typescript
// 获取最近 10 条推文
// 计算：(likes + retweets + replies) / followers * 100
const avgEngagement = totalEngagement / tweets.length
const engagementRate = (avgEngagement / followers_count) * 100
```

---

## 已知限制

### Twitter API 限制
- ❌ 搜索仅支持最近 7 天（无法突破）
- ❌ 每次搜索最多 100 条结果
- ❌ 需要付费计划（Basic $100/月 或 Pro $5000/月）
- ⚠️ 当前账号额度已用完（402 CreditsDepleted）

### 功能限制
- ⚠️ 健康监控页面未实现（占位符）
- ⚠️ 内容效果追踪未实现（占位符）
- ⚠️ 竞品雷达未实现（占位符）
- ⚠️ XHunt 集成已移除

### 数据维护
- 互动率需手动刷新（无自动化）
- AI 分析需逐个触发
- 无后台定时任务

---

## 部署步骤

### 1. 本地开发
```bash
cd enflunce-radar
npm install
npm run dev
```

### 2. Vercel 部署
```bash
# 登录 Vercel
npx vercel login

# 部署
npx vercel --prod

# 添加环境变量
npx vercel env add VARIABLE_NAME production
```

### 3. 数据库初始化
在 Supabase SQL Editor 中执行 `supabase/schema.sql`

---

## 项目结构

```
enflunce-radar/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # 侧边栏布局
│   │   │   ├── page.tsx            # 首页（重定向到 /kols）
│   │   │   ├── discover/           # KOL 发现
│   │   │   ├── kols/               # KOL 名录
│   │   │   │   ├── [id]/           # KOL 详情
│   │   │   │   ├── batch-import/   # 批量导入
│   │   │   │   └── health/         # 健康监控（占位符）
│   │   │   ├── crm/                # CRM 管理
│   │   │   ├── content/            # 内容效果（占位符）
│   │   │   ├── competitor/         # 竞品雷达（占位符）
│   │   │   └── xhunt/              # XHunt（占位符）
│   │   ├── api/
│   │   │   ├── discover/           # 搜索 API
│   │   │   ├── kols/               # KOL CRUD API
│   │   │   └── collaborations/     # 合作 CRUD API
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Sidebar.tsx             # 侧边栏导航
│   │   ├── KolTable.tsx            # KOL 列表表格
│   │   ├── KolFilters.tsx          # 筛选器
│   │   ├── AddKolButton.tsx        # 添加 KOL 按钮
│   │   ├── AddKolModal.tsx         # 添加 KOL 弹窗
│   │   └── RefreshStatsButton.tsx  # 刷新数据按钮
│   ├── lib/
│   │   ├── supabase.ts             # Supabase 客户端
│   │   └── utils.ts                # 工具函数
│   └── types/
│       └── index.ts                # TypeScript 类型定义
├── supabase/
│   └── schema.sql                  # 数据库 Schema
├── .env.local                      # 环境变量（不提交）
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 使用场景

### 场景 1：发现新 KOL
1. 访问 `/discover`
2. 输入关键词（如 "Polymarket", "prediction market"）
3. 设置最低粉丝数和时间范围
4. 点击搜索
5. 查看结果，选择语区和状态标记
6. 批量导入到 CRM

### 场景 2：管理现有 KOL
1. 访问 `/kols`
2. 使用筛选器查找目标 KOL
3. 点击"详情"查看完整信息
4. 使用"重新分析"获取 AI 角色分析
5. 添加合作记录

### 场景 3：批量导入
1. 访问 `/kols/batch-import`
2. 粘贴 @handle 列表
3. 点击导入
4. 系统自动获取用户信息并入库

### 场景 4：刷新数据
1. 访问 `/kols`
2. 选择需要刷新的 KOL（通过筛选器）
3. 点击"🔄 刷新数据"
4. 系统批量获取最新互动率和发帖时间

---

## 未来优化方向

### 短期（1-2 周）
- [ ] 完善错误提示（用户友好的错误信息）
- [ ] 添加加载状态动画
- [ ] 实现健康监控页面
- [ ] 添加导出功能（CSV/Excel）

### 中期（1-2 月）
- [ ] 自动化数据刷新（定时任务）
- [ ] 内容效果追踪功能
- [ ] 竞品雷达功能
- [ ] 用户权限系统

### 长期（3-6 月）
- [ ] 降低 Twitter API 依赖（爬虫方案）
- [ ] 多平台支持（Telegram, Discord）
- [ ] 高级分析报表
- [ ] 移动端适配

---

## 常见问题

### Q: 为什么搜索不到 KOL？
A: 检查 Twitter API 额度是否用完（402 CreditsDepleted 错误）。需要升级到付费计划。

### Q: 如何添加新的角色类型？
A: 修改 `src/app/api/kols/[id]/ai-analyze/route.ts` 中的 `ROLES` 和 `ROLE_DESCRIPTIONS`。

### Q: 如何修改 Tier 分级标准？
A: 修改 `src/lib/utils.ts` 中的 `computeTier` 函数。

### Q: 如何添加新的语言支持？
A: 在 `src/types/index.ts` 中添加新的 `Language` 类型，并更新相关组件。

---

## 联系方式

- **项目地址：** https://enflunce-radar.vercel.app
- **GitHub：** （待添加）
- **文档：** 本文件

---

**最后更新：** 2026-03-16
**版本：** 1.0.0
