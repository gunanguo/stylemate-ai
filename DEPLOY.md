# 部署到 Render + Neon

手机打开一个 https 地址就能用。仓库在 Cursor Origin 的 `gunanguo/stylemate-ai`，分支 `main`。线上跑的是一个普通 Node 网站（Nitro 的 `render-com` 预设），监听 Render 给的 `PORT`，并绑在 `0.0.0.0`。

本地不填 `DATABASE_URL` 时仍用嵌入式 PGLite。Render 免费实例的磁盘不保留数据，所以线上必须用 [Neon](https://neon.tech) 的免费 Postgres。

不填 `XAI_API_KEY` 也能打开：穿搭和「买前问衣橱」走规则，照片识别改为手填。

`*.onrender.com` 在大陆通常比 `*.vercel.app` 好打开，但仍可能慢。免费实例大约 15 分钟没人访问会休眠，下一次打开要等它醒，可能要一分钟。

## 1. Neon

用邮箱或 GitHub 注册 Neon，一般不要求大陆手机号。新建一个项目，复制 **pooled** 连接串（主机名里带 `-pooler`）：

```text
postgres://用户:密码@ep-xxxx-pooler.地区.aws.neon.tech/neondb?sslmode=require
```

这就是 `DATABASE_URL`。不要提交到仓库。

## 2. 环境变量

| 变量 | 必填 | 谁来填 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | 你贴上一步的 Neon 连接串。没填它时会改读 `POSTGRES_URL`。 |
| `BETTER_AUTH_SECRET` | 是 | `render.yaml` 里写了 `generateValue: true`，用 Blueprint 创建时 Render 会自己生成。不要自己发明一个短密码。 |
| `BETTER_AUTH_URL` | 否 | 留空即可。程序会用 Render 自动提供的 `RENDER_EXTERNAL_URL`（形如 `https://stylemate-ai.onrender.com`）。以后绑了自己的域名，再填 `https://你的域名`，末尾不要斜杠。 |
| `XAI_API_KEY` | 否 | 留空也能用。以后想要真正的模型回复，再在 Render 里补上并重新部署。 |
| `VITE_SOCIAL_LOGIN` | 否 | 不要设。默认只有邮箱和密码。 |
| `GROK_AUTH_CLIENT_ID` | 否 | 只有要 Google / X 登录时才和下面一项、以及 `VITE_SOCIAL_LOGIN=true` 一起填。 |
| `GROK_AUTH_CLIENT_SECRET` | 否 | 同上。 |
| `GROK_AUTH_ISSUER` | 否 | 一般不用填。 |

`render.yaml` 还会设置 `NODE_VERSION=22` 和 `HOST=0.0.0.0`。`PORT` 由 Render 注入，不要自己改。

邮箱登录接受 `https://*.onrender.com`，也接受你填的 `BETTER_AUTH_URL`。报 `Invalid origin` 时，核对地址栏里的协议和主机。

## 3. 建表

不用进 Neon 控制台手动建表。

- 构建命令 `npm run build` 的最后一步会执行 `npm run db:migrate`。
- 启动命令 `npm start` 会再跑一遍迁移，然后启动网站。已经执行过的文件不会重复跑。

想在自己电脑上提前建表：

```bash
DATABASE_URL="postgres://..." npm run db:migrate
```

## 4. 在 Render 上创建服务

仓库里的 `render.yaml` 是 Blueprint：免费套餐、Node 22、区域新加坡、构建 `npm run build`、启动 `npm start`、健康检查 `/`。

Render 只能从它能克隆的 Git 拉代码（GitHub、GitLab、Bitbucket，或一个**公开**的 Git 地址），或者部署一个已经放在镜像仓库里的 Docker 镜像。它读不到 Cursor Origin 上的私有仓库。怎么把代码送上去，见下一节。代码到位之后：

1. 打开 [dashboard.render.com](https://dashboard.render.com) → New → Blueprint。
2. 选已经包含这份 `main` 的仓库。
3. Blueprint 会问 `DATABASE_URL`，贴 Neon 的连接串。`BETTER_AUTH_SECRET` 不用填。`BETTER_AUTH_URL` 和 `XAI_API_KEY` 可以留空。
4. 等部署变成 Live。手机打开 `https://<服务名>.onrender.com`，注册一个邮箱。第一次如果刚从休眠醒来，多等一会儿。

绑自己的域名：服务 → Settings → Custom Domains，按页面上的说明改 DNS。然后把 `BETTER_AUTH_URL` 设成 `https://这个域名`，再 Manual Deploy 一次。

## 5. 代码怎么到 Render（按你在手机上要做的事，从少到多）

现在的代码只在 Cursor Origin 的私有仓库里。GitHub 上旧的 [github.com/gunanguo/stylemate-ai](https://github.com/gunanguo/stylemate-ai) **不是**这一版，不要直接拿它部署。在你明确同意之前，不会把代码推到 Origin 以外的地方。

### 方案 A：推到你自己的 GitHub，再用 Render 连 GitHub（推荐）

手机上 Render 这一步最少：New → Blueprint → 选 `gunanguo/stylemate-ai` → 贴 `DATABASE_URL`。

前提是 Origin 的 `main` 先出现在 GitHub。手机本身推不了这个私有仓库。需要下面之一：

- 一台电脑，在 Origin 仓库里执行 `git push` 到 `https://github.com/gunanguo/stylemate-ai.git` 的 `main`（会覆盖 GitHub 上的旧代码，推之前看一眼旧仓库还有没有要留的提交）。
- 或者给一个 **GitHub Personal Access Token**（只要这个仓库的读写权限）给能帮你推的人。Token 等于仓库钥匙，用完就撤销。不要发到公开聊天里。

Render 账号用 GitHub 登录之后，一般不用再单独交一个 Render API key。

### 方案 B：GitHub 仓库设为公开，Render 填公开 Git 地址

仍然要先完成方案 A 的那一次推送。然后在 GitHub 手机网页把仓库改成 Public。Render 选 Public Git Repository，地址填 `https://github.com/gunanguo/stylemate-ai`。不用把 GitHub 授权给 Render。代价是代码公开（仓库里没有密钥）。

### 方案 C：Docker 镜像

不经过 Git。需要一个 Docker Hub（或 GHCR）账号。有人在电脑上构建镜像并 push，你在 Render 选 Existing Image，填镜像名和 `DATABASE_URL`。以后改代码要重新构建镜像，手机上做不了。需要你提供镜像仓库的登录或 access token，而且那一步会把镜像推到 Docker Hub，不属于这次提交。

### 方案 D：只给 Render API key

不够。Render 的 API 创建网站时仍然要一个它能克隆的 Git 仓库，或者一个镜像。API key 只能代替在网页上点几下，不能代替方案 A 或方案 C。

GitLab、Bitbucket 和方案 A 一样，只是换一个 Render 支持的 Git 网站。你已经有的是 GitHub 账号 `gunanguo`。

## 附录：Vercel

构建机上如果存在 `VERCEL=1`，仍会打出原来的 Vercel Build Output（`.vercel/output`）。不设这个变量时（Render 和本地 `npm run build`）打出的是 Node 服务，目录 `.output/server`。本地启动：

```bash
npm run build
npm start
```

Vercel 注册需要手机验证，大陆号码过不了，所以不再作为主方案。`*.vercel.app` 的登录来源仍然保留。
