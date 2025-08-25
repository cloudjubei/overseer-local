import json
import re
from pathlib import Path


def get_repo_root() -> Path:
    p = Path(__file__).resolve()
    for ancestor in p.parents:
        if (ancestor / 'tasks').is_dir():
            return ancestor
    # Fallback (should not happen in normal layout)
    return Path(__file__).resolve().parents[3]


def read_package_json(repo_root: Path) -> dict:
    pkg_path = repo_root / 'package.json'
    assert pkg_path.exists(), f"package.json not found at {pkg_path}"
    data = json.loads(pkg_path.read_text(encoding='utf-8'))
    assert isinstance(data, dict), "package.json is not a JSON object"
    return data


def test_dev_dependencies_include_prettier_and_config():
    repo_root = get_repo_root()
    pkg = read_package_json(repo_root)
    dev_deps = pkg.get('devDependencies') or {}
    assert isinstance(dev_deps, dict), "devDependencies missing or not an object"

    assert 'prettier' in dev_deps, "'prettier' is missing from devDependencies"
    assert isinstance(dev_deps.get('prettier'), str) and dev_deps['prettier'].strip(), "'prettier' version must be a non-empty string"

    assert 'eslint-config-prettier' in dev_deps, "'eslint-config-prettier' is missing from devDependencies"
    assert isinstance(dev_deps.get('eslint-config-prettier'), str) and dev_deps['eslint-config-prettier'].strip(), "'eslint-config-prettier' version must be a non-empty string"


def test_prettierrc_defaults_present():
    repo_root = get_repo_root()
    prettierrc_path = repo_root / '.prettierrc'
    assert prettierrc_path.exists(), f".prettierrc not found at {prettierrc_path}"

    try:
        cfg = json.loads(prettierrc_path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        raise AssertionError(f".prettierrc is not valid JSON: {e}")

    assert cfg.get('semi') is False, "Expected .prettierrc semi=false"
    assert cfg.get('singleQuote') is True, "Expected .prettierrc singleQuote=true"
    assert cfg.get('trailingComma') == 'all', "Expected .prettierrc trailingComma='all'"
    assert cfg.get('printWidth') == 100, "Expected .prettierrc printWidth=100"


def test_eslint_config_integrates_prettier():
    repo_root = get_repo_root()
    eslint_path = repo_root / '.eslintrc.cjs'
    assert eslint_path.exists(), f".eslintrc.cjs not found at {eslint_path}"

    text = eslint_path.read_text(encoding='utf-8')
    # Basic checks: file mentions extends and includes 'prettier'
    assert 'extends' in text, "Expected 'extends' in .eslintrc.cjs"
    assert re.search(r"['\"]prettier['\"]", text), "Expected 'prettier' to be included in extends in .eslintrc.cjs"


def test_package_json_scripts_lint_and_format():
    repo_root = get_repo_root()
    pkg = read_package_json(repo_root)
    scripts = pkg.get('scripts') or {}
    assert isinstance(scripts, dict), "scripts missing or not an object in package.json"

    # format script
    assert 'format' in scripts, "Missing 'format' script in package.json"
    fmt = scripts['format']
    assert isinstance(fmt, str) and fmt.strip(), "'format' script must be a non-empty string"
    assert 'prettier' in fmt, "'format' script must invoke 'prettier'"
    assert '--write' in fmt, "'format' script must include '--write'"
    # Ensure it targets the project (usually '.')
    assert '.' in fmt, "'format' script should target the project (e.g., '.')"

    # lint script
    assert 'lint' in scripts, "Missing 'lint' script in package.json"
    lint = scripts['lint']
    assert isinstance(lint, str) and lint.strip(), "'lint' script must be a non-empty string"
    assert 'eslint' in lint, "'lint' script must invoke 'eslint'"

    # Ensure it lints TypeScript files (.ts and .tsx) explicitly
    lint_lower = lint.lower()
    has_ts = '.ts' in lint_lower
    has_tsx = 'tsx' in lint_lower
    assert has_ts and has_tsx, "'lint' script must lint TypeScript files (include both .ts and .tsx)"
