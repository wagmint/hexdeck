# Variables
NPM = npm
NPX = npx
API_PORT = 3002
FRONTEND_PORT = 3000

# Default target
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make pylon          - Start Pylon (API + dashboard) in foreground"
	@echo "  make start          - Start Pylon server in background"
	@echo "  make stop           - Stop Pylon server"
	@echo "  make restart        - Restart Pylon server"
	@echo "  make status         - Show Pylon server status"
	@echo "  make install        - Install all dependencies"
	@echo "  make build          - Build frontend"
	@echo "  make checkpoint NOTE='my note' - Create a checkpoint"
	@echo "  make rewind ID='abc123'       - Rewind to a checkpoint"
	@echo "  make checkpoints              - List all checkpoints"
	@echo "  make parse          - Run CLI parser (usage: make parse ARGS='projects')"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Remove build artifacts and node_modules"

# Pylon (API + dashboard)
.PHONY: pylon
pylon:
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

.PHONY: typecheck
typecheck:
	cd packages/server && $(NPX) tsc --noEmit

# Cleanup
.PHONY: clean
clean:
	rm -rf node_modules packages/*/node_modules packages/server/dist packages/cli/dist packages/local/.next packages/local/out
