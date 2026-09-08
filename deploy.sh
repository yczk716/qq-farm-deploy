#!/usr/bin/env bash
# ============================================================
# deploy.sh — QQ Farm Bot Docker Compose 一键部署
# 用法: sudo bash deploy.sh        （Ubuntu/Debian, linux/amd64）
#
# 做什么:
#   1. 检查/安装 Docker 与 Compose 插件
#   2. 生成 docker/.env（随机密钥，已 gitignore，不会进仓库）
#   3. 从 mlikiowa/napcat-docker 镜像抽取 QQ for Linux（约600MB，仓库不含）
#   4. 构建并启动全部容器（含 QQ 登录的 napcat-farm）
#   5. 打印访问入口与后续步骤
# ============================================================
set -euo pipefail
R="\033[31m"; G="\033[32m"; Y="\033[33m"; B="\033[36m"; N="\033[0m"
info(){ echo -e "${G}[info]${N} $*"; }
warn(){ echo -e "${Y}[warn]${N} $*"; }
err(){ echo -e "${R}[error]${N} $*"; exit 1; }

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

[ "$(id -u)" = "0" ] || { err "请用 root 运行: sudo bash deploy.sh"; }
[ "$(uname -m)" = "x86_64" ] || warn "非 x86_64 机器未测试，QQ 二进制仅提供 amd64 版"

# ---------- 1/5 Docker ----------
info "1/5 检查 Docker..."
if ! command -v docker >/dev/null 2>&1; then
  warn "未检测到 docker，安装中（get.docker.com）..."
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || err "缺少 docker compose 插件，请升级 Docker"
info "Docker 就绪: $(docker -v)"

# ---------- 2/5 .env ----------
info "2/5 生成 docker/.env（含随机密钥）..."
if [ -f docker/.env ]; then
  warn "docker/.env 已存在，保留现值不覆盖"
else
  cp docker/.env.example docker/.env
  YYBTOK="$(openssl rand -hex 16)"
  CODEPWD="$(openssl rand -hex 6)"
  sed -i "s#REPLACE_WITH_YOUR_YYB_TOKEN#${YYBTOK}#" docker/.env
  sed -i "s#^NAPCAT_CODE_WEB_PASSWORD=.*#NAPCAT_CODE_WEB_PASSWORD=${CODEPWD}#" docker/.env
  # WX_OPENID 留占位：绑定微信账号后，从 yyb-go 管理页取得再填（否则仅影响微信保活）
  info "  YYB_API_TOKEN / 8088 访问密码 已随机生成，见 docker/.env"
fi

# ---------- 3/5 QQ for Linux ----------
info "3/5 准备 QQ for Linux 二进制（docker/qq-linux/）..."
if [ -d docker/qq-linux ] && [ -x docker/qq-linux/qq ]; then
  info "  已存在，跳过抽取"
else
  rm -f docker/qq-linux-placeholder
  IMG="m.daocloud.io/docker.io/mlikiowa/napcat-docker:latest"
  docker pull "$IMG" >/dev/null 2>&1 || IMG="docker.io/mlikiowa/napcat-docker:latest"
  docker pull "$IMG"
  docker rm -f qq-farm-qq-extract >/dev/null 2>&1 || true
  docker create --name qq-farm-qq-extract "$IMG" >/dev/null
  rm -rf docker/qq-linux
  docker cp qq-farm-qq-extract:/opt/QQ docker/qq-linux
  docker rm qq-farm-qq-extract >/dev/null
  [ -x docker/qq-linux/qq ] || err "QQ 二进制抽取失败（docker/qq-linux/qq 不存在）"
  info "  已抽取 QQ $(grep -oE '[0-9]+\.[0-9]+\.[0-9]+-[0-9]+' docker/qq-linux/resources/app/package.json 2>/dev/null || echo '')"
fi

# ---------- 4/5 构建并启动 ----------
info "4/5 构建镜像并启动容器（首次约 3-10 分钟）..."
cd docker
docker compose --profile qq-login build
docker compose --profile qq-login up -d
cd "$REPO"

# ---------- 5/5 完成提示 ----------
sleep 5
echo -e "${B}==========================================================${N}"
echo -e "${G} 部署完成！${N}"
echo -e "${B}==========================================================${N}"
echo -e " 农场面板    : ${B}http://<服务器IP>:3010${N}  （默认 admin/admin，登录后请改密）"
echo -e " QQ 扫码登录 : 面板左侧 ${B}QQ扫码登录${N}（/qr-login）→ 手机QQ扫码 → 授权并启动账号"
echo -e " 微信登录    : 面板 ${B}账号管理 → 添加账号${N}（应用宝 token 已自动生成）"
echo -e " 扫码取码页  : ${B}http://<服务器IP>:8088${N}  密码见 docker/.env 的 NAPCAT_CODE_WEB_PASSWORD"
echo -e " 应用宝管理  : ${B}http://<服务器IP>:8450${N}"
echo -e ""
echo -e "${Y} 安全提醒:${N}"
echo -e "  1. 云服务器请在防火墙/安全组放行 3010/8088/8450/8099/8080，其余端口勿放行"
echo -e "  2. 8080(下载)/8099(GID) 面向公网开放有风险，不需要就别放行"
echo -e "  3. 微信账号长期挂机请绑定后把 openid 填入 docker/.env 的 WX_OPENID 并重启 yyb-keepalive"
echo -e "  4. 升级/维护 SOP 见 docs/UPDATE-GUIDE.md"
echo -e "${B}==========================================================${N}"
docker compose -f docker/docker-compose.yml --profile qq-login ps
