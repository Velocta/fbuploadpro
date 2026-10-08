#!/usr/bin/env bash
# ==============================================================================
# FBUploadPro - Autonomous Spec-Driven Development Setup
# ==============================================================================
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   FBUploadPro Agentic Spec-Driven Development Setup            ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Initialize or verify git
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init -b main
    echo -e "${GREEN}✓ Git initialized.${NC}"
else
    echo -e "${GREEN}✓ Git repository detected.${NC}"
fi

# 2. Check permissions on scripts
echo -e "${YELLOW}Configuring script permissions...${NC}"
find .specify/scripts -type f -name "*.sh" -exec chmod +x {} + 2>/dev/null || true
find .agents/skills -type f -name "*.sh" -exec chmod +x {} + 2>/dev/null || true
echo -e "${GREEN}✓ Helper scripts set to executable.${NC}"

# 3. Environment check
echo -e "${YELLOW}Checking environment dependencies...${NC}"
command -v git >/dev/null 2>&1 && echo -e "${GREEN}✓ git is available${NC}" || echo -e "${YELLOW}! git not found${NC}"
command -v node >/dev/null 2>&1 && echo -e "${GREEN}✓ node is available ($(node --version))${NC}" || echo -e "${YELLOW}! node not found${NC}"
command -v pnpm >/dev/null 2>&1 && echo -e "${GREEN}✓ pnpm is available ($(pnpm --version))${NC}" || echo -e "${YELLOW}! pnpm not found${NC}"
command -v python3 >/dev/null 2>&1 && echo -e "${GREEN}✓ python3 is available ($(python3 --version))${NC}" || echo -e "${YELLOW}! python3 not found${NC}"

echo ""
echo -e "${GREEN}FBUploadPro agent environment is ready!${NC}"
echo -e "Next steps in your AI agent chat:"
echo -e "  1. Run ${CYAN}/grill-me${NC} for interactive pre-flight interview alignment."
echo -e "  2. Run ${CYAN}/speckit-specify <description>${NC} to create your feature specification."
echo -e "  3. Follow through ${CYAN}/speckit-plan${NC}, ${CYAN}/speckit-tasks${NC}, and ${CYAN}/speckit-implement${NC} (multi-agent execution)."
echo ""
