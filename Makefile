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
	@echo "  make build          - Build TypeScript"
	@echo "  make parse          - Run CLI parser (usage: make parse ARGS='projects')"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Remove build artifacts and node_modules"
	@echo ""
	@echo "Frontend (run from frontend/):"
	@echo "  cd frontend && npm run dev   - Start Next.js dev server (port $(FRONTEND_PORT))"

# API server
.PHONY: start
start:
	@echo "Starting Pylon API on port $(API_PORT)..."
	$(NPX) tsx src/server/index.ts &
	@echo "API running at http://localhost:$(API_PORT)"

.PHONY: stop
stop:
	@echo "Stopping Pylon API..."
	@lsof -i :$(API_PORT) -t | xargs kill -9 2>/dev/null || true
	@echo "Stopped."

.PHONY: restart
restart: stop start

# CLI
.PHONY: parse
parse:
	$(NPX) tsx src/cli/parse.ts $(ARGS)

# Install
.PHONY: install
install:
	$(NPM) install
	cd frontend && $(NPM) install

# Build
.PHONY: build
build:
	$(NPX) tsc

.PHONY: typecheck
typecheck:
	$(NPX) tsc --noEmit

# Cleanup
.PHONY: clean
clean:
	rm -rf dist node_modules frontend/node_modules frontend/.next
