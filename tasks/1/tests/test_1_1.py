import json
import os
from pathlib import Path

import pytest


def repo_root() -> Path:
    # tests are expected at tasks/1/tests/test_1_1.py
    return Path(__file__).resolve().parents[3]


def app_root() -> Path:
    return repo_root() / "src" / "desktop"


def load_json(p: Path) -> dict:
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")


def test_bootstrap_scripts_exist_and_reference_electron_vite():
    root = repo_root()
    mjs = root / "scripts" / "bootstrap_desktop_app.mjs"
    sh = root / "scripts" / "bootstrap_desktop_app.sh"
    ps1 = root / "scripts" / "bootstrap_desktop_app.ps1"

    assert mjs.is_file(), f"Missing bootstrap script: {mjs}"
    assert sh.is_file(), f"Missing shell wrapper: {sh}"
    assert ps1.is_file(), f"Missing PowerShell wrapper: {ps1}"

    content = read_text(mjs).lower()
    assert "create-electron-vite" in content or "electron-vite" in content, (
        "bootstrap_desktop_app.mjs should reference electron-vite scaffolding"
    )
    assert "react-ts" in content or "react" in content, (
        "bootstrap_desktop_app.mjs should indicate React TypeScript template"
    )


def test_docs_updated_for_desktop_app():
    root = repo_root()
    org = root / "docs" / "FILE_ORGANISATION.md"
    assert org.is_file(), f"Missing documentation file: {org}"
    org_text = read_text(org)
    assert "src/desktop/" in org_text, "docs/FILE_ORGANISATION.md should mention src/desktop/"

    app_readme = root / "docs" / "apps" / "desktop" / "README.md"
    assert app_readme.is_file(), f"Missing app docs: {app_readme}"
    app_text = read_text(app_readme).lower()
    for needle in ["electron-vite", "react", "typescript", "prerequisites"]:
        assert needle in app_text, f"docs/apps/desktop/README.md should contain '{needle}'"

    task_readme = root / "docs" / "tasks" / "1" / "README.md"
    assert task_readme.is_file(), f"Missing task docs: {task_readme}"


def test_gitignore_has_desktop_entries():
    gi = repo_root() / ".gitignore"
    assert gi.is_file(), f"Missing .gitignore at {gi}"
    text = read_text(gi)
    assert "src/desktop/node_modules" in text, "Expected 'src/desktop/node_modules' to be ignored"
    assert "src/desktop/dist" in text, "Expected 'src/desktop/dist' to be ignored"


def test_app_scaffold_root_exists():
    assert app_root().is_dir(), f"Expected scaffold directory to exist at {app_root()}"


def test_package_json_scripts():
    pj = app_root() / "package.json"
    assert pj.is_file(), f"Missing package.json at {pj}"
    data = load_json(pj)
    scripts = data.get("scripts", {}) or {}
    required = ["dev", "build", "preview", "lint", "typecheck", "build:win", "build:mac", "build:linux"]
    missing = [k for k in required if k not in scripts]
    assert not missing, f"Missing scripts in package.json: {missing}. Found: {list(scripts.keys())}"
    assert "electron-vite" in scripts.get("dev", ""), "dev script should include 'electron-vite'"
    assert "electron-vite" in scripts.get("build", ""), "build script should include 'electron-vite'"


def test_config_files_exist():
    files = [
        app_root() / "electron.vite.config.ts",
        app_root() / "tsconfig.json",
    ]
    for f in files:
        assert f.is_file(), f"Expected config file {f} to exist."


def test_source_layout_is_valid_electron_vite():
    # Accept either current electron-vite layout (src/main, src/preload, src/renderer)
    # or the older electron/ + src/ layout.
    root = app_root()
    current_layout = all((root / p).is_dir() for p in ["src/main", "src/preload", "src/renderer"])

    legacy_layout = all((root / p).is_file() for p in [
        "electron/main/index.ts",
        "electron/preload/index.ts",
        "src/main.tsx",
    ])

    assert current_layout or legacy_layout, (
        "Expected either current electron-vite layout (src/main, src/preload, src/renderer) "
        "or legacy layout (electron/main/index.ts, electron/preload/index.ts, src/main.tsx)."
    )


def test_required_dependencies_present():
    pj = app_root() / "package.json"
    data = load_json(pj)
    deps = data.get("dependencies", {}) or {}
    dev_deps = data.get("devDependencies", {}) or {}

    required = ["electron", "electron-vite", "react", "typescript"]
    missing = [name for name in required if name not in deps and name not in dev_deps]
    assert not missing, (
        "Missing required packages in dependencies/devDependencies: "
        + ", ".join(missing)
        + f". dependencies keys: {list(deps.keys())}, devDependencies keys: {list(dev_deps.keys())}"
    )


def test_lint_and_prettier_configs_exist():
    eslintrc = app_root() / ".eslintrc.cjs"
    prettierrc = app_root() / ".prettierrc.json"
    assert eslintrc.is_file(), f"Missing ESLint config: {eslintrc}"
    assert prettierrc.is_file(), f"Missing Prettier config: {prettierrc}"


def test_npmrc_contains_save_exact():
    npmrc = app_root() / ".npmrc"
    assert npmrc.is_file(), f"Missing .npmrc at {npmrc}"
    text = read_text(npmrc)
    assert "save-exact=true" in text, ".npmrc should contain 'save-exact=true'"


def test_baseline_files_exist():
    env_example = app_root() / ".env.example"
    readme = app_root() / "README.md"
    assert env_example.is_file(), f"Missing baseline file: {env_example}"
    assert readme.is_file(), f"Missing README: {readme}"
