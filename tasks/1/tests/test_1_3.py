import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
README_PATH = os.path.join(ROOT, 'README.md')


def read_readme():
    assert os.path.exists(README_PATH), f"README.md not found at {README_PATH}"
    with open(README_PATH, 'r', encoding='utf-8') as f:
        return f.read()


class TestReadmeElectronScaffold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.content = read_readme()

    def test_title_and_stack(self):
        c = self.content
        # Title must start with a Markdown heading and include Electron, React, TypeScript
        first_heading = re.search(r"^# +(.+)$", c, flags=re.MULTILINE)
        self.assertIsNotNone(first_heading, "README must start with a level-1 heading")
        title = first_heading.group(1)
        for word in ["Electron", "React", "TypeScript"]:
            self.assertRegex(title, re.compile(word, re.IGNORECASE), f"Title must include '{word}'")
        self.assertRegex(c, re.compile(r"electron[- ]?vite", re.IGNORECASE), "README must mention 'electron-vite'")

    def test_table_of_contents(self):
        self.assertRegex(self.content, re.compile(r"^#{2,}\s*Table of Contents", re.IGNORECASE | re.MULTILINE), "Missing 'Table of Contents' section heading")

    def test_required_sections(self):
        c = self.content
        sections = {
            "Overview": r"^#{2,}\s*Overview",
            "Requirements": r"^#{2,}\s*Requirements",
            "Quick Start": r"^#{2,}\s*Quick\s*Start",
            "Scripts": r"^#{2,}\s*Scripts",
            "Project Structure": r"^#{2,}\s*Project\s*Structure",
            "Security Defaults": r"^#{2,}\s*Security\s*Defaults",
            "TypeScript Setup": r"^#{2,}\s*Type\s*Script\s*Setup|^#{2,}\s*TypeScript\s*Setup",
            "Linting & Formatting": r"^#{2,}\s*Linting\s*&\s*Formatting",
            "Environment Variables & CSP": r"^#{2,}\s*(Environment\s*Variables.*CSP|CSP)",
            "Development Guidelines": r"^#{2,}\s*Development\s*Guidelines",
            "Build & Distribution": r"^#{2,}\s*Build\s*&\s*Distribution",
            "Troubleshooting": r"^#{2,}\s*Troubleshooting",
            "Contributing": r"^#{2,}\s*Contributing",
            "License": r"^#{2,}\s*License"
        }
        for name, pattern in sections.items():
            self.assertRegex(c, re.compile(pattern, re.IGNORECASE | re.MULTILINE), f"Missing '{name}' section heading")

    def test_quick_start_commands(self):
        c = self.content
        # Install command
        self.assertTrue(
            re.search(r"pnpm\s+install", c, re.IGNORECASE) or re.search(r"npm\s+install", c, re.IGNORECASE),
            "Quick Start must include an install command (pnpm install or npm install)"
        )
        # Dev command
        self.assertTrue(
            re.search(r"pnpm\s+dev", c, re.IGNORECASE) or re.search(r"npm\s+run\s+dev", c, re.IGNORECASE),
            "Quick Start must include a dev command (pnpm dev or npm run dev)"
        )
        # Build command
        self.assertTrue(
            re.search(r"pnpm\s+build", c, re.IGNORECASE) or re.search(r"npm\s+run\s+build", c, re.IGNORECASE),
            "Quick Start must include a build command (pnpm build or npm run build)"
        )

    def test_scripts_commands(self):
        c = self.content
        # Must include a Scripts heading
        self.assertRegex(c, re.compile(r"^#{2,}\s*Scripts", re.IGNORECASE | re.MULTILINE), "Missing 'Scripts' section")
        # And references to dev, build, lint, format commands
        self.assertTrue(
            re.search(r"\bdev\b", c, re.IGNORECASE) and re.search(r"\bbuild\b", c, re.IGNORECASE),
            "Scripts section must reference dev and build commands"
        )
        self.assertTrue(
            (re.search(r"pnpm\s+lint", c, re.IGNORECASE) or re.search(r"npm\s+run\s+lint", c, re.IGNORECASE)),
            "Scripts must include a lint command example"
        )
        self.assertTrue(
            (re.search(r"pnpm\s+format", c, re.IGNORECASE) or re.search(r"npm\s+run\s+format", c, re.IGNORECASE)),
            "Scripts must include a format command example"
        )

    def test_security_defaults_and_ipc_examples(self):
        c = self.content
        # Security defaults mentions
        self.assertRegex(c, re.compile(r"contextIsolation", re.IGNORECASE), "Security Defaults must mention contextIsolation")
        self.assertRegex(c, re.compile(r"nodeIntegration", re.IGNORECASE), "Security Defaults must mention nodeIntegration")
        # IPC and preload references
        self.assertIn("contextBridge.exposeInMainWorld", c, "README must include contextBridge.exposeInMainWorld reference")
        self.assertIn("ipcMain.handle", c, "README must include ipcMain.handle reference")
        self.assertIn("ipcRenderer.invoke", c, "README must include ipcRenderer.invoke reference")

    def test_project_structure(self):
        c = self.content
        self.assertRegex(c, re.compile(r"packages/main", re.IGNORECASE), "Project Structure must mention packages/main")
        self.assertRegex(c, re.compile(r"packages/preload", re.IGNORECASE), "Project Structure must mention packages/preload")
        self.assertRegex(c, re.compile(r"packages/renderer", re.IGNORECASE), "Project Structure must mention packages/renderer")

    def test_build_dist(self):
        c = self.content
        self.assertRegex(c, re.compile(r"\bdist/?\b", re.IGNORECASE), "Build & Distribution must mention dist output")

    def test_requirements_node_version(self):
        c = self.content
        self.assertRegex(c, re.compile(r"Node(\.js)?", re.IGNORECASE), "Requirements must mention Node.js")
        # Look for LTS versions like 18 or 20
        self.assertTrue(re.search(r"\b1?8\b", c) or re.search(r"\b20\b", c), "Requirements should hint Node.js LTS versions (e.g., 18 or 20)")

    def test_license_reference(self):
        c = self.content
        self.assertRegex(c, re.compile(r"^#{2,}\s*License", re.IGNORECASE | re.MULTILINE), "Missing License section heading")
        # Expect mention of a common license name
        has_license_name = any(re.search(pattern, c, re.IGNORECASE) for pattern in [r"\bMIT\b", r"Apache", r"BSD", r"GPL", r"MPL"])
        self.assertTrue(has_license_name, "License section should reference a known license name (e.g., MIT)")


if __name__ == '__main__':
    unittest.main()
