import json
import os
from pathlib import Path

import pytest


def repo_root() -> Path:
    # tests are expected at tasks/1/tests/test_1_1.py
    return Path(__file__).resolve().parents[3]


def app_root() -> Path:
    return repo_root() / "projects" / "electron-react-ts-app"


def load_package_json(p: Path) -> dict:
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def test_package_json_exists():
    pj = app_root() / "package.json"
    assert pj.exists(), f"Expected package.json at {pj}, but it does not exist."


def test_package_json_has_required_scripts():
    pj = app_root() / "package.json"
    assert pj.exists(), f"package.json missing at {pj}"
    data = load_package_json(pj)
    scripts = data.get("scripts", {})
    missing = [s for s in ("dev", "build", "lint") if s not in scripts]
    assert not missing, f"Missing scripts in package.json: {missing}. Found: {list(scripts.keys())}"


def test_required_directories_exist():
    for rel in ["src/main", "src/preload", "src/renderer"]:
        d = app_root() / rel
        assert d.is_dir(), f"Expected directory {d} to exist."


def test_required_config_files_exist():
    files = [
        "electron.vite.config.ts",
        ".eslintrc.cjs",
        "tsconfig.json",
    ]
    for rel in files:
        f = app_root() / rel
        assert f.is_file(), f"Expected config file {f} to exist."


def test_required_dependencies_present():
    pj = app_root() / "package.json"
    assert pj.exists(), f"package.json missing at {pj}"
    data = load_package_json(pj)
    deps = data.get("dependencies", {}) or {}
    dev_deps = data.get("devDependencies", {}) or {}

    required = ["electron", "electron-vite", "react", "typescript"]
    missing = []
    for name in required:
        if name not in deps and name not in dev_deps:
            missing.append(name)

    assert not missing, (
        "Missing required packages in dependencies/devDependencies: "
        + ", ".join(missing)
        + f". dependencies keys: {list(deps.keys())}, devDependencies keys: {list(dev_deps.keys())}"
    )
