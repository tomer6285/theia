#!/usr/bin/env bash

# ==============================================================================
# Theia — Multi-Platform & Multi-Architecture Release Script
# Builds Electron desktop releases for:
#   - Linux:   AMD64 (x86_64) & ARM64 (aarch64) [AppImage, Debian (.deb), Fedora (.rpm)]
#   - Windows: AMD64 (x64)    & ARM64 (arm64)
#   - macOS:   AMD64 (x64)    & ARM64 (Apple Silicon)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color formatting
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default to the host platform and physical CPU (including Macs under Rosetta).
case "$(uname -s)" in
  Linux) HOST_OS=linux ;;
  Darwin) HOST_OS=mac ;;
  MINGW*|MSYS*|CYGWIN*) HOST_OS=win ;;
  *) HOST_OS=unknown ;;
esac
HOST_ARCH="$(uname -m)"
if [ "$HOST_OS" = mac ] && [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
  HOST_ARCH=arm64
fi
if [ "$HOST_OS" = win ]; then
  HOST_ARCH="${PROCESSOR_ARCHITEW6432:-${PROCESSOR_ARCHITECTURE:-$HOST_ARCH}}"
fi
case "$HOST_ARCH" in
  x86_64|amd64|AMD64|x64) HOST_ARCH=x64 ;;
  aarch64|arm64|ARM64) HOST_ARCH=arm64 ;;
esac
TARGET_OS="$HOST_OS"
ARCH_SELECTION="$HOST_ARCH"
BUILD_RPM=true
RPM_ONLY=false
DIR_ONLY=false
SKIP_TESTS=false

for arg in "$@"; do
  case "$arg" in
    --linux-only) TARGET_OS=linux; RPM_ONLY=false ;;
    --win-only) TARGET_OS=win; RPM_ONLY=false ;;
    --mac-only) TARGET_OS=mac; RPM_ONLY=false ;;
    --rpm-only|--rpm) TARGET_OS=linux; RPM_ONLY=true ;;
    --skip-rpm|--no-rpm) BUILD_RPM=false ;;
    --x64|--amd64) ARCH_SELECTION=x64 ;;
    --arm64) ARCH_SELECTION=arm64 ;;
    --all-arch) ARCH_SELECTION=all ;;
    --dir) DIR_ONLY=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --help|-h)
      cat <<'HELP'
Usage: ./release.sh [OPTIONS]
Defaults to the current OS and CPU architecture.

  --linux-only   Build Linux AppImage, deb, and rpm (when rpmbuild is available)
  --win-only     Build Windows installers
  --mac-only     Build macOS DMGs (requires a macOS host)
  --rpm-only     Build only Linux RPM packages (requires rpmbuild)
  --skip-rpm     Skip RPM packages
  --x64          Build for x64 (alias: --amd64)
  --arm64        Build for ARM64
  --all-arch     Build both x64 and ARM64 for the selected OS
  --dir          Produce unpacked directories instead of installers
  --skip-tests   Skip core unit tests
  -h, --help     Show this help

When multiple OS or architecture flags are supplied, the last one wins.
HELP
      exit 0
      ;;
    *) echo "ERROR: Unknown option: $arg" >&2; exit 1 ;;
  esac
done

case "$TARGET_OS" in
  linux|win|mac) ;;
  *) echo "ERROR: Unsupported host OS. Select --linux-only, --win-only, or --mac-only." >&2; exit 1 ;;
esac
case "$ARCH_SELECTION" in
  x64|arm64) ARCHES=("$ARCH_SELECTION") ;;
  all) ARCHES=(x64 arm64) ;;
  *) echo "ERROR: Unsupported CPU: $HOST_ARCH. Select --x64, --arm64, or --all-arch." >&2; exit 1 ;;
esac
if [ "$TARGET_OS" = mac ] && [ "$HOST_OS" != mac ]; then
  echo "ERROR: macOS packaging requires a macOS host. Run this script on a Mac or macOS CI runner." >&2
  exit 1
fi
if [ "$RPM_ONLY" = true ] && [ "$BUILD_RPM" = false ]; then
  echo "ERROR: --rpm-only cannot be combined with --skip-rpm." >&2
  exit 1
fi

echo -e "${CYAN}"
echo "=========================================================="
echo "   Theia — Multi-Arch Release Build Pipeline"
echo "=========================================================="
echo -e "${NC}"

echo "Host: $HOST_OS/$HOST_ARCH; target: $TARGET_OS; architectures: ${ARCHES[*]}"

# Check rpmbuild tool availability for RPM builds
HAS_RPMBUILD=true
if ! command -v rpmbuild &> /dev/null; then
  HAS_RPMBUILD=false
fi

if [ "$RPM_ONLY" = true ] && [ "$HAS_RPMBUILD" = false ]; then
  echo -e "${RED}ERROR: 'rpmbuild' is required to package Fedora RPM packages.${NC}"
  echo -e "Please install it with:"
  echo -e "  - Ubuntu/Debian: sudo apt-get install rpm"
  echo -e "  - Fedora/RHEL:   sudo dnf install rpm-build"
  exit 1
fi

# 1. Verification & Tests
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${YELLOW}==> Running unit tests in @theia/core...${NC}"
  pnpm exec vitest run packages/core/test
else
  echo -e "${YELLOW}==> Skipping unit tests (--skip-tests specified)${NC}"
fi

# 2. Compile Web Frontend & Monorepo Packages
echo -e "\n${YELLOW}==> Building web frontend and dependent packages with Turborepo...${NC}"
pnpm exec turbo run build --filter=@theia/web
pnpm --filter @theia/electron build

# Navigate to electron package directory for builder
cd apps/electron

EXTRA_BUILDER_FLAGS=()
if [ "$DIR_ONLY" = true ]; then
  EXTRA_BUILDER_FLAGS+=(--dir)
fi

LINUX_TARGETS=(AppImage deb)
if [ "$TARGET_OS" = linux ]; then
  if [ "$RPM_ONLY" = true ]; then
    LINUX_TARGETS=(rpm)
  elif [ "$BUILD_RPM" = true ]; then
    if [ "$HAS_RPMBUILD" = true ]; then
      LINUX_TARGETS+=(rpm)
    else
      echo "Warning: rpmbuild not detected; skipping RPM packages."
    fi
  fi
fi

for arch in "${ARCHES[@]}"; do
  echo -e "\n${YELLOW}==> Packaging $TARGET_OS ($arch)...${NC}"
  case "$TARGET_OS" in
    linux)
      pnpm exec electron-builder --linux "${LINUX_TARGETS[@]}" "--$arch" "${EXTRA_BUILDER_FLAGS[@]}"
      ;;
    win)
      pnpm exec electron-builder --win "--$arch" "${EXTRA_BUILDER_FLAGS[@]}" -c.win.signAndEditExecutable=false
      ;;
    mac)
      pnpm exec electron-builder --mac "--$arch" "${EXTRA_BUILDER_FLAGS[@]}"
      ;;
  esac
done

# 6. Release Summary
cd "$SCRIPT_DIR"
echo -e "\n${GREEN}=========================================================="
echo "   Build Succeeded! Generated Artifacts in apps/electron/release:"
echo "==========================================================${NC}"

if [ -d "apps/electron/release" ]; then
  ls -lh apps/electron/release
fi

echo -e "\n${CYAN}Built $TARGET_OS packages for: ${ARCHES[*]}.${NC}\n"
