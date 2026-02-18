# Variables
NPM = npm
NPX = npx
API_PORT = 3002
FRONTEND_PORT = 3000

# Default target
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make start          - Start API server (port $(API_PORT))"
	@echo "  make stop           - Stop API server"
	@echo "  make restart        - Restart API server"
	@echo "  make install        - Install all dependencies"
	@echo "  make build          - Build frontend"
	@echo "  make checkpoint NOTE='my note' - Create a checkpoint"
	@echo "  make rewind ID='abc123'       - Rewind to a checkpoint"
	@echo "  make checkpoints              - List all checkpoints"
	@echo "  make parse          - Run CLI parser (usage: make parse ARGS='projects')"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Remove build artifacts and node_modules"

# API server
.PHONY: start
start:
	@echo "Starting Pylon API on port $(API_PORT)..."
	cd packages/server && $(NPX) tsx src/server/index.ts &
	@echo "API running at http://localhost:$(API_PORT)"

.PHONY: stop
stop:
	@echo "Stopping Pylon API..."
	@lsof -i :$(API_PORT) -t | xargs kill -9 2>/dev/null || true
	@echo "Stopped."

.PHONY: restart
restart: stop start

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
	$(NPM) run build --workspace=packages/local

.PHONY: typecheck
typecheck:
	cd packages/server && $(NPX) tsc --noEmit

# Cleanup
.PHONY: clean
clean:
	rm -rf node_modules packages/*/node_modules packages/server/dist packages/local/.next
