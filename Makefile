# Variables
NPM = npm
NPX = npx
API_PORT = 7433
FRONTEND_PORT = 3000
LEVEL ?= patch

# Default target
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make hexdeck          - Start Hexdeck (API + dashboard) in foreground"
	@echo "  make start          - Start Hexdeck server in background"
	@echo "  make stop           - Stop Hexdeck server"
	@echo "  make restart        - Restart Hexdeck server"
	@echo "  make status         - Show Hexdeck server status"
	@echo "  make install        - Install all dependencies"
	@echo "  make build          - Build frontend"
	@echo "  make dashboard-version [LEVEL=patch|minor|major] - Bump @hexdeck/dashboard-ui version"
	@echo "  make cli-version [LEVEL=patch|minor|major]       - Bump @hexdeck/cli version"
	@echo "  make checkpoint NOTE='my note' - Create a checkpoint"
	@echo "  make rewind ID='abc123'       - Rewind to a checkpoint"
	@echo "  make checkpoints              - List all checkpoints"
	@echo "  make parse          - Run CLI parser (usage: make parse ARGS='projects')"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Remove build artifacts and node_modules"

# Hexdeck (API + dashboard)
.PHONY: hexdeck
hexdeck:
	cd packages/cli && $(NPX) tsx src/index.ts start --foreground

.PHONY: start
start:
	cd packages/cli && $(NPX) tsx src/index.ts start

.PHONY: stop
stop:
	cd packages/cli && $(NPX) tsx src/index.ts stop

.PHONY: restart
restart:
	cd packages/cli && $(NPX) tsx src/index.ts restart

.PHONY: status
status:
	cd packages/cli && $(NPX) tsx src/index.ts status

# Checkpoints
.PHONY: checkpoint
checkpoint:
	cd packages/server && $(NPX) tsx src/cli/index.ts checkpoint $(NOTE)

.PHONY: rewind
rewind:
	cd packages/server && $(NPX) tsx src/cli/index.ts rewind $(ID)

.PHONY: checkpoints
checkpoints:
	cd packages/server && $(NPX) tsx src/cli/index.ts checkpoints

# CLI
.PHONY: parse
parse:
	cd packages/server && $(NPX) tsx src/cli/parse.ts $(ARGS)

# Install
.PHONY: install
install:
	$(NPM) install

# Build
.PHONY: build
build:
	$(NPM) run build

.PHONY: dashboard-version
dashboard-version:
	cd packages/dashboard-ui && $(NPM) version $(LEVEL) --no-git-tag-version

.PHONY: cli-version
cli-version:
	cd packages/cli && $(NPM) version $(LEVEL) --no-git-tag-version

.PHONY: typecheck
typecheck:
	cd packages/server && $(NPX) tsc --noEmit

# Cleanup
.PHONY: clean
clean:
	rm -rf node_modules packages/*/node_modules packages/server/dist packages/cli/dist packages/local/.next packages/local/out
