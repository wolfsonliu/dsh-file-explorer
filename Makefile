# dsh-file-explorer — build & deploy helpers for the DSH Web plugin.
#
# Common workflows:
#   make install      full local install: deps -> build -> register into the profile
#   make install-all  make install + install every optional preview extension
#   make extensions   install every optional preview extension from the README
#   make deploy       (re)register the local checkout into the profile (fast)
#   make undeploy     un-register the plugin from the profile
#   make web          boot the web profile
#   make release      register the released GitHub version (remote source)
#
# See `make help` for the full list.

DSH     ?= dsh
PROFILE ?= web
NPM     ?= npm
# Published package name (package.json "name"), used to un-register.
PLUGIN  ?= @dsh-external/dsh-file-explorer
# Remote source for a released install (README "From the git repository").
REMOTE  ?= github:wolfsonliu/dsh-file-explorer

# Optional preview extensions (README "Optional preview plugins").
EXTENSIONS ?= \
	github:wolfsonliu/dsh-file-explorer-preview-code \
	github:wolfsonliu/dsh-file-explorer-preview-molstar \
	github:wolfsonliu/dsh-file-explorer-preview-sequence

.PHONY: help install install-all extensions deps build check test deploy undeploy web release clean

help:
	@printf '%s\n' \
		'dsh-file-explorer — build & deploy helpers' \
		'' \
		'  make install    deps -> build -> register into the $(PROFILE) profile' \
		'  make install-all  make install + install every optional preview extension' \
		'  make extensions  install every optional preview extension (see README)' \
		'  make deps       $(NPM) install' \
		'  make build      tsc + tsdown -> lib/' \
		'  make check      tsc --noEmit (type-checks src/ only)' \
		'  make test       vitest run (tests/**/*.spec.{ts,tsx})' \
		'  make deploy     $(DSH) plugin --profile $(PROFILE) add .' \
		'  make undeploy   $(DSH) plugin --profile $(PROFILE) remove $(PLUGIN)' \
		'  make web        $(DSH) web' \
		'  make release    $(DSH) plugin --profile $(PROFILE) add $(REMOTE)' \
		'  make clean      rm -rf lib/ (forced rebuild; run `make build` after)' \
		'' \
		'Overridable: DSH=$(DSH) PROFILE=$(PROFILE) NPM=$(NPM) PLUGIN=$(PLUGIN) REMOTE=$(REMOTE)'

# Full local install: dependencies, fresh build, then register the checkout.
install: deps build deploy

# Core install plus every optional preview extension.
install-all: install extensions

# Install every optional preview extension (README "Optional preview plugins").
extensions:
	@set -e; for ext in $(EXTENSIONS); do \
		printf '%s\n' "> adding $$ext"; \
		$(DSH) plugin --profile $(PROFILE) add "$$ext"; \
	done

deps:
	$(NPM) install

build:
	$(NPM) run build

check:
	$(NPM) run check

# One spec: ./node_modules/.bin/vitest run tests/<file> (never `npx vitest`).
test:
	$(NPM) test

# Register this checkout as a plugin (pnpm `add .` into the profile directory).
deploy:
	$(DSH) plugin --profile $(PROFILE) add .

undeploy:
	$(DSH) plugin --profile $(PROFILE) remove $(PLUGIN)

web:
	$(DSH) web

release:
	$(DSH) plugin --profile $(PROFILE) add $(REMOTE)

# lib/ is committed; remove it only to force a clean rebuild.
clean:
	rm -rf lib