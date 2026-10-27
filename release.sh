#!/usr/bin/env bash

# ==============================================================================
# Dion Touch (dion-tc) — Multi-Platform & Multi-Architecture Release Script
# Builds Electron desktop releases for:
#   - Linux:   AMD64 (x86_64) & ARM64 (aarch64)
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

BUILD_LINUX=true
BUILD_WIN=true
BUILD_MAC=true
DIR_ONLY=false
SKIP_TESTS=false

# Parse command line flags
for arg in "$@"; do
  case $arg in
    --linux-only)
      BUILD_LINUX=true
      BUILD_WIN=false
      BUILD_MAC=false
      ;;
    --win-only)
      BUILD_LINUX=false
      BUILD_WIN=true
      BUILD_MAC=false
      ;;
    --mac-only)
      BUILD_LINUX=false
      BUILD_WIN=false
      BUILD_MAC=true
      ;;
    --dir)
      DIR_ONLY=true
      ;;
    --skip-tests)
      SKIP_TESTS=true
      ;;
    --help|-h)
      echo "Usage: ./release.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --linux-only   Build only Linux targets (amd64, arm64)"
      echo "  --win-only     Build only Windows targets (amd64, arm64)"
      echo "  --mac-only     Build only macOS targets (amd64, arm64)"
      echo "  --dir          Package into unpacked directories instead of installers"
      echo "  --skip-tests   Skip running test suites prior to build"
      echo "  -h, --help     Show this help message"
      exit 0
      ;;
  esac
done

echo -e "${CYAN}"
echo "=========================================================="
echo "   Dion Touch — Multi-Arch Release Build Pipeline"
echo "=========================================================="
echo -e "${NC}"

# 1. Verification & Tests
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${YELLOW}==> Running unit tests in @dion/core...${NC}"
  pnpm --filter @dion/core test
else
  echo -e "${YELLOW}==> Skipping unit tests (--skip-tests specified)${NC}"
fi

# 2. Compile Web Frontend & Monorepo Packages
echo -e "\n${YELLOW}==> Building web frontend and dependent packages with Turborepo...${NC}"
pnpm --filter @dion/web build
pnpm --filter @dion/electron build

# Navigate to electron package directory for builder
cd apps/electron

EXTRA_BUILDER_FLAGS=""
if [ "$DIR_ONLY" = true ]; then
  EXTRA_BUILDER_FLAGS="--dir"
fi

# 3. Linux Multi-Arch Builds (amd64 + arm64)
if [ "$BUILD_LINUX" = true ]; then
  echo -e "\n${YELLOW}==> Packaging Linux AMD64 (x86_64)...${NC}"
  npx electron-builder --linux --x64 $EXTRA_BUILDER_FLAGS

  echo -e "\n${YELLOW}==> Packaging Linux ARM64 (aarch64)...${NC}"
  npx electron-builder --linux --arm64 $EXTRA_BUILDER_FLAGS
fi

# 4. Windows Multi-Arch Builds (amd64 + arm64)
if [ "$BUILD_WIN" = true ]; then
  echo -e "\n${YELLOW}==> Packaging Windows AMD64 (x64)...${NC}"
  npx electron-builder --win --x64 $EXTRA_BUILDER_FLAGS -c.win.signAndEditExecutable=false

  echo -e "\n${YELLOW}==> Packaging Windows ARM64 (arm64)...${NC}"
  npx electron-builder --win --arm64 $EXTRA_BUILDER_FLAGS -c.win.signAndEditExecutable=false
fi

# 5. macOS Multi-Arch Builds (amd64 + arm64)
if [ "$BUILD_MAC" = true ]; then
  echo -e "\n${YELLOW}==> Packaging macOS AMD64 (x64 / Intel)...${NC}"
  npx electron-builder --mac --x64 $EXTRA_BUILDER_FLAGS

  echo -e "\n${YELLOW}==> Packaging macOS ARM64 (arm64 / Apple Silicon)...${NC}"
  npx electron-builder --mac --arm64 $EXTRA_BUILDER_FLAGS
fi

# 6. Release Summary
cd "$SCRIPT_DIR"
echo -e "\n${GREEN}=========================================================="
echo "   Build Succeeded! Generated Artifacts in apps/electron/release:"
echo "==========================================================${NC}"

if [ -d "apps/electron/release" ]; then
  ls -lh apps/electron/release
fi

echo -e "\n${CYAN}All OS versions for AMD64 and ARM have been successfully built!${NC}\n"
