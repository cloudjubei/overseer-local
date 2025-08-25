import json
import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

class TestLintingAndFormatting(unittest.TestCase):
    def test_config_files_exist(self):
        for f in [
            '.eslintrc.cjs',
            '.editorconfig',
            '.prettierrc.json',
            '.prettierignore',
            '.eslintignore',
        ]:
            path = os.path.join(ROOT, f)
            self.assertTrue(os.path.exists(path), f"Missing {f}")

    def test_setup_script_exists(self):
        path = os.path.join(ROOT, 'scripts', 'setup-linting-formatting.js')
        self.assertTrue(os.path.exists(path), 'Missing setup script')

    def test_husky_pre_commit(self):
        hook = os.path.join(ROOT, '.husky', 'pre-commit')
        self.assertTrue(os.path.exists(hook), 'Missing .husky/pre-commit hook')
        with open(hook, 'r', encoding='utf-8') as fh:
            content = fh.read()
        self.assertIn('npx --no-install lint-staged', content)

    def test_ci_workflow_exists(self):
        path = os.path.join(ROOT, '.github', 'workflows', 'lint.yml')
        self.assertTrue(os.path.exists(path), 'Missing CI workflow .github/workflows/lint.yml')
        with open(path, 'r', encoding='utf-8') as fh:
            content = fh.read()
        self.assertIn('ESLint', content)
        self.assertIn('Prettier (check)', content)

    def test_package_json_if_present(self):
        pkg_path = os.path.join(ROOT, 'package.json')
        if not os.path.exists(pkg_path):
            self.skipTest('package.json not present; setup script will add scripts when run')
        with open(pkg_path, 'r', encoding='utf-8') as fh:
            pkg = json.load(fh)
        scripts = pkg.get('scripts', {})
        for k in ['lint', 'lint:fix', 'format', 'format:check', 'prepare']:
            self.assertIn(k, scripts, f'Missing script: {k}')
        ls = pkg.get('lint-staged', {})
        self.assertIn('*.{js,jsx,ts,tsx,cjs,mjs}', ls)
        self.assertIn('*.{json,css,scss,md,yml,yaml,html}', ls)

if __name__ == '__main__':
    unittest.main()
