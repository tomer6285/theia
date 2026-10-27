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

BUILD_LINUX=true
BUILD_WIN=true
BUILD_MAC=true
BUILD_RPM=true
RPM_ONLY=false
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
    --rpm-only|--rpm)
      BUILD_LINUX=false
      BUILD_WIN=false
      BUILD_MAC=false
      BUILD_RPM=true
      RPM_ONLY=true
      ;;
    --skip-rpm|--no-rpm)
      BUILD_RPM=false
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
      echo "  --linux-only   Build only Linux targets (AppImage, deb, Fedora rpm for amd64, arm64)"
      echo "  --rpm-only     Build only Fedora RPM packages (amd64, arm64)"
      echo "  --skip-rpm     Skip Fedora RPM package generation during Linux build"
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
echo "   Theia — Multi-Arch Release Build Pipeline"
echo "=========================================================="
echo -e "${NC}"

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
  pnpm --filter @theia/core test
else
  echo -e "${YELLOW}==> Skipping unit tests (--skip-tests specified)${NC}"
fi

# 2. Compile Web Frontend & Monorepo Packages
echo -e "\n${YELLOW}==> Building web frontend and dependent packages with Turborepo...${NC}"
pnpm --filter @theia/web build
pnpm --filter @theia/electron build

# Navigate to electron package directory for builder
cd apps/electron

EXTRA_BUILDER_FLAGS=""
if [ "$DIR_ONLY" = true ]; then
  EXTRA_BUILDER_FLAGS="--dir"
fi

# 3. Linux Multi-Arch Builds (amd64 + arm64)
if [ "$BUILD_LINUX" = true ] || [ "$RPM_ONLY" = true ]; then
  if [ "$RPM_ONLY" = true ]; then
    echo -e "\n${YELLOW}==> Packaging Fedora RPM AMD64 (x86_64)...${NC}"
    npx electron-builder --linux rpm --x64 $EXTRA_BUILDER_FLAGS

    echo -e "\n${YELLOW}==> Packaging Fedora RPM ARM64 (aarch64)...${NC}"
    npx electron-builder --linux rpm --arm64 $EXTRA_BUILDER_FLAGS
  else
    LINUX_TARGETS=("AppImage" "deb")
    if [ "$BUILD_RPM" = true ]; then
      if [ "$HAS_RPMBUILD" = true ]; then
        LINUX_TARGETS+=("rpm")
      else
        echo -e "\n${YELLOW}==> Warning: 'rpmbuild' not detected. Skipping Fedora RPM packages.${NC}"
        echo -e "${YELLOW}    To enable Fedora RPM packages, install rpm: sudo apt-get install rpm (Ubuntu/Debian) or sudo dnf install rpm-build (Fedora/RHEL)${NC}"
      fi
    fi

    TARGETS_STR="${LINUX_TARGETS[*]}"
    echo -e "\n${YELLOW}==> Packaging Linux AMD64 (x86_64) [${TARGETS_STR}]...${NC}"
    npx electron-builder --linux "${LINUX_TARGETS[@]}" --x64 $EXTRA_BUILDER_FLAGS

    echo -e "\n${YELLOW}==> Packaging Linux ARM64 (aarch64) [${TARGETS_STR}]...${NC}"
    npx electron-builder --linux "${LINUX_TARGETS[@]}" --arm64 $EXTRA_BUILDER_FLAGS
  fi
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

if [ "$RPM_ONLY" = true ]; then
  echo -e "\n${CYAN}Fedora RPM packages for AMD64 and ARM64 have been successfully built!${NC}\n"
else
  echo -e "\n${CYAN}All requested OS and package versions for AMD64 and ARM have been successfully built!${NC}\n"
fi
