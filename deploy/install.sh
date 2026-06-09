#!/usr/bin/env bash
# First-time SavesManager install on a Raspberry Pi (or any Debian-ish host).
# Run on the Pi: sudo ./install.sh
set -euo pipefail

REPO="${SAVESMANAGER_REPO:-dylanclaywell/saves-manager}"
INSTALL_DIR="${SAVESMANAGER_DIR:-/opt/savesmanager}"
SERVICE="${SAVESMANAGER_SERVICE:-savesmanager}"
RUN_USER="${SAVESMANAGER_USER:-pi}"

if [[ $EUID -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo -E "$0" "$@"
fi

echo "==> Installing prerequisites (curl, unzip)"
apt-get update -qq
apt-get install -y -qq curl unzip ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 20.x from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
else
  echo "==> Node already installed: $(node --version)"
fi

NODE_BIN="$(command -v node)"
echo "==> Using node at $NODE_BIN"

echo "==> Creating $INSTALL_DIR (owned by $RUN_USER)"
mkdir -p "$INSTALL_DIR"
chown -R "$RUN_USER":"$RUN_USER" "$INSTALL_DIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"
UPDATE_SRC="$SCRIPT_DIR/update.sh"
UNIT_SRC="$SCRIPT_DIR/savesmanager.service"

if [[ ! -f "$UPDATE_SRC" || ! -f "$UNIT_SRC" ]]; then
  echo "==> Bootstrap: fetching update.sh + savesmanager.service from latest release"
  BOOT_TMP=$(mktemp -d)
  trap 'rm -rf "$BOOT_TMP"' EXIT
  curl -fsSL -o "$BOOT_TMP/update.sh" \
    "https://github.com/${REPO}/releases/latest/download/update.sh"
  curl -fsSL -o "$BOOT_TMP/savesmanager.service" \
    "https://github.com/${REPO}/releases/latest/download/savesmanager.service"
  UPDATE_SRC="$BOOT_TMP/update.sh"
  UNIT_SRC="$BOOT_TMP/savesmanager.service"
fi

echo "==> Installing update.sh to $INSTALL_DIR/update.sh"
install -m 0755 -o "$RUN_USER" -g "$RUN_USER" "$UPDATE_SRC" "$INSTALL_DIR/update.sh"

echo "==> Installing systemd unit"
UNIT_DST="/etc/systemd/system/${SERVICE}.service"
sed \
  -e "s|^User=.*|User=${RUN_USER}|" \
  -e "s|^Group=.*|Group=${RUN_USER}|" \
  -e "s|^WorkingDirectory=.*|WorkingDirectory=${INSTALL_DIR}|" \
  -e "s|^ExecStart=.*|ExecStart=${NODE_BIN} ${INSTALL_DIR}/.output/server/index.mjs|" \
  "$UNIT_SRC" > "$UNIT_DST"

systemctl daemon-reload
systemctl enable "$SERVICE"

echo "==> Downloading first build via update.sh"
SAVESMANAGER_REPO="$REPO" \
SAVESMANAGER_DIR="$INSTALL_DIR" \
SAVESMANAGER_SERVICE="$SERVICE" \
  "$INSTALL_DIR/update.sh"

echo
echo "Install complete."
echo "Service:   systemctl status $SERVICE"
echo "Logs:      journalctl -u $SERVICE -f"
echo "Update:    sudo $INSTALL_DIR/update.sh"
