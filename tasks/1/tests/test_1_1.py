import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_bootstrap_scripts_exist_and_reference_template():
    mjs = ROOT / 'scripts' / 'bootstrap_desktop_app.mjs'
    sh = ROOT / 'scripts' / 'bootstrap_desktop_app.sh'
    ps1 = ROOT / 'scripts' / 'bootstrap_desktop_app.ps1'
    assert mjs.is_file(), 'bootstrap_desktop_app.mjs is missing'
    assert sh.is_file(), 'bootstrap_desktop_app.sh is missing'
    assert ps1.is_file(), 'bootstrap_desktop_app.ps1 is missing'

    content = mjs.read_text(encoding='utf-8')
    assert 'create-electron-vite' in content, 'bootstrap script should use create-electron-vite'
    assert 'react-ts' in content, 'bootstrap script should reference react-ts template'


def test_docs_updated():
    org = ROOT / 'docs' / 'FILE_ORGANISATION.md'
    assert org.is_file(), 'FILE_ORGANISATION.md missing'
    txt = org.read_text(encoding='utf-8').lower()
    assert 'src/desktop' in txt, 'FILE_ORGANISATION.md should mention src/desktop'

    app_readme = ROOT / 'docs' / 'apps' / 'desktop' / 'README.md'
    assert app_readme.is_file(), 'docs/apps/desktop/README.md missing'
    artxt = app_readme.read_text(encoding='utf-8').lower()
    assert 'electron-vite' in artxt and 'react' in artxt and 'typescript' in artxt

    task_readme = ROOT / 'docs' / 'tasks' / '1' / 'README.md'
    assert task_readme.is_file(), 'docs/tasks/1/README.md missing'


def test_gitignore_has_desktop_entries():
    gi = ROOT / '.gitignore'
    assert gi.is_file(), '.gitignore missing'
    txt = gi.read_text(encoding='utf-8')
    assert 'src/desktop/node_modules' in txt
    assert 'src/desktop/dist' in txt


def test_scaffold_exists_and_has_required_files():
    base = ROOT / 'src' / 'desktop'
    assert base.is_dir(), 'src/desktop missing'

    pkg_path = base / 'package.json'
    assert pkg_path.is_file(), 'src/desktop/package.json missing'
    pkg = json.loads(pkg_path.read_text(encoding='utf-8'))

    scripts = pkg.get('scripts', {})
    for s in ['dev', 'build', 'preview', 'lint', 'typecheck', 'build:win', 'build:mac', 'build:linux']:
        assert s in scripts, f'script {s} missing in package.json'
    assert 'electron-vite' in scripts['dev'] and 'electron-vite' in scripts['build'], 'dev/build scripts should use electron-vite'

    # Required dependencies
    deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
    for dep in ['electron', 'electron-vite', 'react', 'typescript']:
        assert dep in deps, f'missing required dependency: {dep}'

    # Config files
    assert (base / 'electron.vite.config.ts').is_file(), 'electron.vite.config.ts missing'
    assert (base / 'tsconfig.json').is_file(), 'tsconfig.json missing'

    # Lint/format configs
    assert (base / '.eslintrc.cjs').is_file(), '.eslintrc.cjs missing'
    assert (base / '.prettierrc.json').is_file(), '.prettierrc.json missing'

    # npm config
    npmrc = base / '.npmrc'
    assert npmrc.is_file(), '.npmrc missing'
    assert 'save-exact=true' in npmrc.read_text(encoding='utf-8'), '.npmrc should contain save-exact=true'

    # Baseline files
    assert (base / '.env.example').is_file(), '.env.example missing'
    assert (base / 'README.md').is_file(), 'src/desktop/README.md missing'


def test_source_layout_exists():
    base = ROOT / 'src' / 'desktop' / 'src'
    modern_layout = (
        (base / 'main' / 'index.ts').is_file()
        and (base / 'preload' / 'index.ts').is_file()
        and (base / 'renderer' / 'index.html').is_file()
    )
    assert modern_layout, 'Expected modern electron-vite layout under src/desktop/src'
