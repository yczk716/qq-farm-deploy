# QQ Farm Bot 一键部署仓库

> [!IMPORTANT]
> **🌟 本项目基于 [shichenovo/qq-farm-server](https://github.com/shichenovo/qq-farm-server) 改进而来 —— 感谢原作者 [@shichenovo](https://github.com/shichenovo)！**
>
> 在原项目（脱敏的 systemd 部署快照）基础上，本仓库做了以下主要改进：
>
> - 🐳 部署形态重写为 **Docker Compose 一键部署**（`deploy.sh`，含 QQ 登录容器编排）
> - 🔐 新增 **QQ 扫码授权登录**（NapCat 桥接 + 前端真实授权结果轮询 + 登录态持久化）
> - 🎨 前端 / 推送 / 调度多处定制补丁（金币单位显示、qmsg 推送修复等）
>
> 👉 **原项目入口：<https://github.com/shichenovo/qq-farm-server>** —— 觉得本仓库有用的话，请先去给原作者点个 Star ⭐
>
> 原项目暂未声明 LICENSE，本仓库仅供个人学习研究；如原作者认为不适宜公开衍生版本，请提 Issue 联系，我会第一时间处理。

本仓库是从一台**正在运行的 QQ 农场 Bot 服务器**导出的完整可部署快照，包含：

- 🤖 农场 Bot 本体（`qq-farm-bot-3010`，已合并上游更新并带定制补丁）
- 🌐 前端面板（含**公益小红花 UI** + **金币按单位(万/亿)显示** + **QQ 扫码授权真实结果轮询**定制）
- 🐧 **QQ + 微信双端挂机**：QQ 走 NapCat 扫码授权，微信走应用宝(YYB)换码
- 🔧 4 个配套服务：好友 GID 提取(8099) / NapCat 扫码取码(8088) / 下载(8080) / 应用宝微信换码(8450)
- 🐳 全套 Docker Compose 编排（含 QQ 登录容器）+ 📜 `deploy.sh` 一键部署
- 📘 **给 AI/维护者的升级 SOP**：[docs/UPDATE-GUIDE.md](docs/UPDATE-GUIDE.md)

> ⚠️ **隐私与体积声明**：本仓库不含任何真实 token / 密码 / 账号数据（`.env`、运行数据、QQ 登录会话均已排除）。
> 腾讯 QQ for Linux 二进制（约 600MB）**不入库**，由 `deploy.sh` 从公开镜像自动抽取。

---

## 架构一览

```
                        ┌─────────────────────────────┐
   浏览器/手机 ───────▶ │  前端面板  :3010 (admin/admin) │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │  qq-farm-bot-3010 (core/dist) │◀── 自动挂机/换码
                        └───┬──────────┬──────────┬─────┘
             NapCat 桥     │          │          │  YYB API
              :9700       │          │          │
        ┌─────────────────▼──┐  ┌─────▼────────┐  ┌▼──────────────┐
        │ napcat 容器(farm)  │  │gid-tool 8099│  │ yyb-go 8450   │
        │ bridge.sock       │  │            │  │ 微信换码       │
        └─────────┬─────────┘  └─────┬────────┘  └───────────────┘
                  │ 8088 扫码页         │ 取好友GID
          ┌───────▼────────┐   ┌───────▼────────┐
          │napcat-code-web │   │  (同上 3010)   │
          └────────────────┘   └────────────────┘

  qq-farm-download :8080  = 静态文件下载服务
  yyb-keepalive           = 每 30 分钟微信 login_buffer 保活
```

**关键事实**：Bot 运行时只加载 `qq-farm-bot-3010/core/dist/*`。`custom-modules/` 只是它的镜像（不参与加载）。
升级 / 改逻辑请改 `core/dist/*`，详见 [UPDATE-GUIDE.md](docs/UPDATE-GUIDE.md)。

---

## 🚀 一键部署（Docker Compose，推荐）

适用：全新 Ubuntu/Debian x86_64 服务器，root 权限，能访问 Docker Hub（国内自动走镜像加速）。

```bash
git clone https://github.com/<你的用户名>/qq-farm-deploy.git qq-farm && cd qq-farm
sudo bash deploy.sh
```

脚本会自动完成：

1. 安装 Docker / Compose（如缺失）
2. 生成 `docker/.env`（**随机**生成 YYB token 与 8088 访问密码，文件已被 gitignore）
3. 从 `mlikiowa/napcat-docker` 公开镜像抽取 QQ for Linux 到 `docker/qq-linux/`
4. 构建全部镜像并启动（含 QQ 登录容器 napcat-farm）
5. 打印访问入口

部署完成后：

| 入口 | 地址 | 说明 |
|---|---|---|
| 农场面板 | `http://<IP>:3010` | 默认 `admin/admin`，**登录后立即改密** |
| QQ 扫码登录 | 面板左侧「QQ扫码登录」（`/qr-login`） | 手机 QQ 扫码 → 确认 → 填账号名 → 授权并启动账号 |
| 微信登录 | 面板「账号管理 → 添加账号」 | 需要 YYB token（deploy.sh 已随机生成） |
| 扫码取码页 | `http://<IP>:8088` | 密码见 `docker/.env` |
| 应用宝管理 | `http://<IP>:8450` | 微信换码通道 |

---

## 手动 Docker 部署（想看每一步的）

```bash
# 1) 配置
cd docker && cp .env.example .env   # 填 YYB_API_TOKEN（随机字符串即可，自签发自验）
# 2) 抽取 QQ 二进制（deploy.sh 第 3 步的等价手工操作）
docker pull m.daocloud.io/docker.io/mlikiowa/napcat-docker:latest
docker create --name t m.daocloud.io/docker.io/mlikiowa/napcat-docker:latest
docker cp t:/opt/QQ ../docker/qq-linux && docker rm t
# 3) 构建启动
docker compose --profile qq-login build
docker compose --profile qq-login up -d
```

> ⚠️ 缺少 `docker/qq-linux/` 时镜像能构建，但 QQ 无法启动（预期行为）。QQ 版本升级方法见 `docs/UPDATE-GUIDE.md`。

---

## 传统部署（systemd，进阶可选）

不依赖 Docker 的宿主机部署方式（node/npm/systemd）：

```bash
sudo bash setup.sh
# 按提示输入 YYB_API_TOKEN；脚本会装依赖 → 铺目录 → 生成 .env/accounts → 装 systemd → 启服务
bash scripts/verify-deploy.sh   # 部署后体检
```

注意：QQ 登录容器（napcat-farm）仍需 Docker，systemd 路线只覆盖其余服务。

---

## NapCat / QQ 登录说明

QQ 登录走 NapCat 容器（`qq-farm-napcat:farm`），由本仓库 `docker/Dockerfile` 构建：
官方 NapCat 4.18.19 装载代码（`docker/napcat-loader/`，已注入本项目所需的
`start_mini_app` 授权动作）+ 自定义桥接（`docker/napcat-bridge/`）+ 从公开镜像抽取的
QQ for Linux（`docker/qq-linux/`，不入库）。

已知行为（非 bug）：

- QQ 扫码登录成功后，容器重启可能需要**重新扫码**（快速登录注册表与扫码会话是两套机制）
- NapCat 日志每 ~2 分钟出现的 `Login Error ErrCode:3` + 重打二维码是过期 token 重试噪音，在线时无害
- 授权偶发被腾讯风控拒绝时，重试或稍后再扫即可

---

## 安全提醒（部署后必做）

| 项 | 默认 | 建议 |
|---|---|---|
| 面板账号/密码 | `admin` / `admin` | **立即改成强密码** |
| 8088 扫码页密码 | deploy.sh 随机生成 | 见 `docker/.env`，勿泄露 |
| 公网端口 | 3010/8088/8450 必需 | 8080(下载)/8099(GID) 不需要就**不要放行**防火墙 |
| YYB token | 本机自签发 | 仅本机使用，勿泄露 |

> 历史上曾有陌生人通过公网暴露的 8088 扫码页扫了自己的 QQ —— 随机密码 + 防火墙最小放行可杜绝。

---

## 目录结构

```
qq-farm-deploy/
├── deploy.sh               # ⭐ Docker Compose 一键部署
├── qq-farm-bot-3010/       # Bot 本体（core/dist 运行时真源 + web/dist 前端 + custom-modules 镜像）
├── gid-tool-web/           # 好友 GID 提取 (8099)
├── napcat-code-web/        # NapCat 扫码取 Code 网页 (8088, 需密码)
├── yyb-go/                 # 应用宝(微信)换码服务 (8450) + keepalive 脚本
├── downloads/              # 下载服务根目录 (8080, 占位)
├── systemd/                # systemd unit 文件（传统部署用，token 为占位符）
├── docker/                 # compose / Dockerfile / napcat-bridge / napcat-loader（qq-linux 由脚本生成）
├── docs/UPDATE-GUIDE.md    # ⭐ AI/维护者升级 SOP（防踩坑）
├── scripts/                # update-bot.sh / verify-deploy.sh（沙箱三方合并与体检）
├── .env.example            # 配置模板（占位符）
├── accounts.example.json   # 账号模板
└── README.md
```

---

## 升级（不要整目录覆盖！）

严格按 [docs/UPDATE-GUIDE.md](docs/UPDATE-GUIDE.md) 的 **3-way merge** 流程。
核心命令：`scripts/update-bot.sh <上游URL> <BASE> <LATEST> <生产bot目录>`，
它在沙箱里构建并合并，把结果放到 `update-out/`，你 Review 后上传，最后跑 `verify-deploy.sh`。

---

## 来源与致谢

- 🌟 **本项目基于 [shichenovo/qq-farm-server](https://github.com/shichenovo/qq-farm-server) 改进而来**：在其脱敏快照（systemd 部署形态）的基础上，重写为 Docker Compose 一键部署、新增 QQ 扫码授权登录链路、并附带少量定制补丁。**二次使用 / 分发时请同样保留对本仓库及原作者的署名。**
- Bot 本体上游：开源项目 [liyangpengs/qq-farm-bot](https://github.com/liyangpengs/qq-farm-bot)（含社区定制）；QQ 登录基于 [NapCatQQ](https://github.com/NapNeko/NapCatQQ)，
  QQ 二进制来自公开镜像 [mlikiowa/napcat-docker](https://github.com/mlikiowa/napcat-docker)，微信换码基于 [yyb-go](https://github.com/cm1916/yyb-go-enhanced)。向以上项目的作者与维护者一并致谢 🙏
- **仅供个人学习研究，请勿用于商业用途；游戏脚本有封号风险，后果自负。**
