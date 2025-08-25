import json
import re
from pathlib import Path


def get_repo_root() -> Path:
    p = Path(__file__).resolve()
    for ancestor in p.parents:
        if (ancestor / 'tasks').is_dir():
            return ancestor
    return Path(__file__).resolve().parents[3]


def read_text(path: Path) -> str:
    assert path.exists(), f"Expected file to exist: {path}"
    return path.read_text(encoding='utf-8')


def read_json(path: Path):
    text = read_text(path)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise AssertionError(f"Invalid JSON in {path}: {e}")


def test_setup_script_exists():
    repo = get_repo_root()
    assert (repo / 'scripts' / 'setup-linting-formatting.js').exists(), 'scripts/setup-linting-formatting.js must exist'


def test_root_config_files_exist():
    repo = get_repo_root()
    for fname in ['.editorconfig', '.prettierrc.json', '.prettierignore', '.eslintignore', '.eslintrc.cjs']:
        assert (repo / fname).exists(), f"Missing required config file: {fname}"


def test_prettier_config_exact_values():
    repo = get_repo_root()
    cfg = read_json(repo / '.prettierrc.json')
    expected = {
        'printWidth': 100,
        'tabWidth': 2,
        'singleQuote': True,
        'trailingComma': 'all',
        'semi': True,
        'arrowParens': 'always',
        'bracketSpacing': True,
        'endOfLine': 'lf',
    }
    for k, v in expected.items():
        assert cfg.get(k) == v, f".prettierrc.json: expected {k}={v!r}, got {cfg.get(k)!r}"


def normalize_lines(text: str) -> list[str]:
    # Normalize newlines and strip trailing whitespace from each line
    return [ln.rstrip() for ln in text.replace('\r\n', '\n').replace('\r', '\n').split('\n') if ln.strip() != '']


def test_prettier_eslint_ignores_have_minimum_entries():
    repo = get_repo_root()
    expected_entries = [
        'node_modules', 'dist', 'build', 'out', 'coverage', '.husky', '.github', '.next', '.cache', '.turbo', '.vite'
    ]
    for fname in ['.prettierignore', '.eslintignore']:
        txt = read_text(repo / fname)
        lines = normalize_lines(txt)
        for entry in expected_entries:
            assert entry in lines, f"{fname} must include entry: {entry}"


def test_eslint_config_integrates_prettier_and_recommended_rules():
    repo = get_repo_root()
    text = read_text(repo / '.eslintrc.cjs')
    # Extends must include plugin:prettier/recommended and prettier
    assert re.search(r"plugin:prettier/recommended", text), "Expected 'plugin:prettier/recommended' in extends"
    assert re.search(r"['\"]prettier['\"]", text), "Expected 'prettier' in extends"
    # Other recommended configs
    for key in [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:n/recommended',
        'plugin:vitest/recommended',
    ]:
        assert key in text, f"Expected '{key}' in extends"
    # Rules checks
    assert "'prettier/prettier': 'error'" in text or '"prettier/prettier": "error"' in text, "Must enforce prettier/prettier as error"
    assert re.search(r"react/react-in-jsx-scope['\"]?\s*:\s*['\"]off['\"]", text), "Must disable react/react-in-jsx-scope"
    assert 'unused-imports/no-unused-imports' in text, "Must include unused-imports/no-unused-imports rule"
    assert re.search(r"@typescript-eslint/no-unused-vars['\"]?\s*:\s*\[\s*['\"]warn['\"].*argsIgnorePattern['\"]?\s*:\s*['\"]\^_['\"]/s", text), "@typescript-eslint/no-unused-vars should warn and ignore vars/args starting with _"


def read_package_json(repo_root: Path) -> dict:
    pkg_path = repo_root / 'package.json'
    assert pkg_path.exists(), f"package.json not found at {pkg_path}"
    data = read_json(pkg_path)
    assert isinstance(data, dict), "package.json is not a JSON object"
    return data


def test_package_json_scripts_and_lint_staged():
    repo = get_repo_root()
    pkg = read_package_json(repo)

    # Scripts
    scripts = pkg.get('scripts') or {}
    assert isinstance(scripts, dict), "scripts missing or not an object"

    # format
    fmt = scripts.get('format')
    assert isinstance(fmt, str) and 'prettier' in fmt and '--write' in fmt and '.' in fmt, "'format' must run 'prettier --write .'"

    # format:check
    fmt_chk = scripts.get('format:check')
    assert isinstance(fmt_chk, str) and 'prettier' in fmt_chk and '--check' in fmt_chk and '.' in fmt_chk, "'format:check' must run 'prettier --check .'"

    # lint
    lint = scripts.get('lint')
    assert isinstance(lint, str) and 'eslint' in lint, "'lint' must invoke eslint"
    lint_lower = lint.lower()
    assert '.ts' in lint_lower and 'tsx' in lint_lower, "'lint' must lint both .ts and .tsx files"

    # lint:fix
    lint_fix = scripts.get('lint:fix')
    assert isinstance(lint_fix, str) and '--fix' in lint_fix, "'lint:fix' must perform a fix run (contain --fix)"

    # prepare
    prepare = scripts.get('prepare')
    assert isinstance(prepare, str) and 'husky install' in prepare, "'prepare' must run 'husky install'"

    # lint-staged
    ls = pkg.get('lint-staged')
    assert isinstance(ls, dict), "lint-staged top-level config must exist in package.json"
    key_js = '*.{js,jsx,ts,tsx,cjs,mjs}'
    key_text = '*.{json,css,scss,md,yml,yaml,html}'
    assert key_js in ls, f"lint-staged must include key: {key_js}"
    assert key_text in ls, f"lint-staged must include key: {key_text}"
    val_js = ls[key_js]
    val_text = ls[key_text]
    assert isinstance(val_js, list) and any('eslint' in cmd and '--fix' in cmd for cmd in val_js), "lint-staged JS/TS key must run 'eslint --fix'"
    assert isinstance(val_text, list) and any('prettier' in cmd and '--write' in cmd for cmd in val_text), "lint-staged text key must run 'prettier --write'"


def test_package_json_dev_dependencies_core_set():
    repo = get_repo_root()
    pkg = read_package_json(repo)
    dev = pkg.get('devDependencies') or {}
    assert isinstance(dev, dict), "devDependencies missing or not an object"
    required = [
        'eslint', 'prettier', 'eslint-config-prettier', 'eslint-plugin-prettier',
        '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin',
        'husky', 'lint-staged'
    ]
    missing = [name for name in required if name not in dev]
    assert not missing, f"Missing devDependencies: {', '.join(missing)}"


def test_husky_precommit_hook():
    repo = get_repo_root()
    path = repo / '.husky' / 'pre-commit'
    assert path.exists(), f"Missing Husky pre-commit hook: {path}"
    txt = read_text(path)
    assert 'npx --no-install lint-staged' in txt, "pre-commit must invoke 'npx --no-install lint-staged'"


def test_developer_docs_exist_and_mention_commands():
    repo = get_repo_root()
    doc = repo / 'docs' / 'tasks' / '1' / 'linting_and_formatting.md'
    assert doc.exists(), f"Missing developer doc: {doc}"
    txt = read_text(doc)
    for token in ['ESLint', 'Prettier', 'Husky', 'lint-staged', 'node scripts/setup-linting-formatting.js', 'npm run lint', 'npm run format']:
        assert token in txt, f"Developer doc must mention: {token}"


def test_file_organisation_mentions_new_dirs():
    repo = get_repo_root()
    txt = read_text(repo / 'docs' / 'FILE_ORGANISATION.md')
    # Look for mentions of scripts/, .husky/, and .github/workflows/
    assert 'scripts/' in txt, "FILE_ORGANISATION.md should mention scripts/"
    assert '.husky/' in txt or 'husky' in txt.lower(), "FILE_ORGANISATION.md should mention .husky/"
    assert '.github/workflows/' in txt or 'workflows' in txt, "FILE_ORGANISATION.md should mention .github/workflows/"


def test_optional_ci_workflow_if_present():
    repo = get_repo_root()
    wf = repo / '.github' / 'workflows' / 'lint.yml'
    if wf.exists():
        txt = read_text(wf)
        assert 'actions/checkout@v4' in txt, "CI workflow should use actions/checkout@v4"
        assert 'actions/setup-node@v4' in txt, "CI workflow should use actions/setup-node@v4"
        assert 'npm run lint' in txt, "CI workflow should run npm run lint"
        assert 'npm run format:check' in txt, "CI workflow should run npm run format:check"