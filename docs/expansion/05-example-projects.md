# 05 - Example Projects

## Summary

Create a set of example/template projects that demonstrate what Overseer can do for prospective users. Each example produces **interactable HTML outputs** that can be opened and viewed on any platform (desktop, web, mobile) -- either within the Overseer app or exported externally.

**Phase:** 3 (requires at least one platform + backend to be functional)

---

## Goal

A new user opens Overseer, picks an example template (e.g. "Create a video game"), and the system guides them through building a working project using AI agents. The output is something they can see, interact with, and share -- primarily as HTML/JS files.

---

## Target Examples

| Example | Output type | Complexity |
|---|---|---|
| **Cross-platform video game** | HTML5 Canvas/WebGL game | High -- game loop, assets, input handling, levels |
| **Board game** | Interactive HTML board with rules engine | Medium -- grid/board UI, turn logic, rules |
| **Book writing** | Formatted HTML/EPUB with chapters, TOC | Medium -- text generation, formatting, structure |
| **Financial planner** | Interactive dashboard with charts, inputs | Medium -- forms, calculations, data visualization |
| **Interior house planner** | 2D/3D room layout tool | High -- drag-and-drop, spatial math, furniture catalog |
| **Car buyer helper** | Comparison tool with filters, recommendations | Medium -- data-driven UI, filtering, scoring |

---

## Architecture: Template System

### What a template is

A template defines the starting point, agent instructions, and expected output structure for a project type:

```
templates/
  video-game/
    template.json          # metadata, description, tags, difficulty
    system-prompt.md       # agent system prompt tailored to this project type
    scaffold/              # initial files copied into the new project
      index.html
      style.css
      game.js
    stories/               # pre-defined stories/features to populate
      01-setup.json
      02-core-mechanics.json
      03-ui.json
      04-polish.json
    preview/               # screenshot or demo for the template picker
      thumbnail.png
```

### template.json

```json
{
  "id": "video-game",
  "name": "Cross-Platform Video Game",
  "description": "Build an HTML5 game with canvas rendering, game loop, and input handling",
  "category": "creative",
  "difficulty": "advanced",
  "estimatedTime": "2-4 hours",
  "tags": ["game", "html5", "canvas", "interactive"],
  "outputType": "html",
  "requiredTools": ["file_write", "file_read", "compile"],
  "scaffold": "./scaffold",
  "stories": "./stories"
}
```

---

## Output Rendering: Interactable HTML

### The core requirement

Projects produce HTML files that users can view and interact with. This needs to work:
- **Desktop (overseer-local):** open in an Electron BrowserView/webview, or launch in the system browser
- **Web (overseer-web):** render in an iframe (sandboxed)
- **Mobile (future):** render in a React Native WebView
- **Exported:** user can download the HTML file(s) and open them anywhere

### Preview component

A reusable `ProjectPreview` component that:
1. Takes a path to an HTML file (or a bundle of HTML/CSS/JS)
2. Renders it in an isolated context (iframe on web, webview on desktop, WebView on mobile)
3. Provides controls: refresh, open externally, export/download, resize
4. Sandboxes the content (no access to the host app's state or filesystem)

### Security considerations

- Sandboxed iframes/webviews with restrictive CSP
- No access to parent window
- No network access unless explicitly granted
- File system access only through the Overseer API (for saving output)

---

## Stories as Project Structure

Each template comes with pre-defined stories that guide the AI agent through building the project. This leverages the existing story/feature system.

Example for **video game**:

1. **Project setup** -- scaffold files, basic HTML structure, canvas element
2. **Core game loop** -- requestAnimationFrame loop, update/render cycle, delta time
3. **Player entity** -- player character, movement, input handling (keyboard/touch)
4. **Game world** -- level design, collision detection, boundaries
5. **Game objects** -- enemies/obstacles/collectibles, spawning, interaction
6. **UI overlay** -- score, lives, start screen, game over screen
7. **Polish** -- animations, sound effects (optional), responsive sizing
8. **Export** -- final build, optimize assets, generate standalone package

Each story has features that break down into agent-actionable tasks.

---

## Open Questions

### Template distribution

1. **Where do templates live?** In the backend? Bundled with each client app? A separate repository?
   - Recommendation: a `templates/` directory in the backend repo, served via API. Clients fetch available templates from the backend.
2. **Can users create their own templates?** Eventually yes, but not for v1.
3. **Template versioning?** Templates may evolve. Version them so existing projects aren't broken.

### Output management

4. **Where are outputs stored?** In the project directory alongside source files? In a separate `output/` or `build/` directory?
5. **Live preview:** can the user see the output updating in real-time as the agent works? This would require file watching + auto-refresh in the preview component.
6. **Multi-file outputs:** a game might have `index.html`, `style.css`, `game.js`, and asset files. The preview needs to serve all of them as a coherent bundle.

### Agent guidance

7. **How prescriptive are the stories?** Do they rigidly define what the agent does, or are they guidelines that the agent interprets?
8. **User customization:** can the user modify the template's stories before starting? (e.g., "I want a space shooter" vs "I want a platformer")
9. **Iterative refinement:** after the initial build, can the user chat with the agent to modify the output? This is just regular chat with context of the existing project files.

---

## Implementation Strategy

### Step 1: Define the template format

- Design `template.json` schema
- Define story/feature JSON format for templates
- Build a template loader that creates a project from a template

### Step 2: Build the preview component

- Desktop: Electron BrowserView or webview tag
- Web: sandboxed iframe
- Support single-file and multi-file HTML projects
- Export/download functionality

### Step 3: Create the first template (simplest)

- Start with **board game** or **financial planner** -- medium complexity, clear structure
- Write the system prompt, scaffold files, and stories
- Test end-to-end: create project from template → agent builds it → preview works

### Step 4: Build remaining templates

- Video game (most complex, save for later)
- Book writing
- Car buyer helper
- Interior planner (most complex, may need specialized tools)

### Step 5: Template browser UI

- Add a template selection step to the project wizard
- Show template thumbnails, descriptions, difficulty
- "Start from template" creates a project with pre-populated files and stories

---

## Dependencies

- Backend must be running (templates served from backend, agents run on backend for web clients)
- Story/feature system must support pre-populating from template definitions
- File system must support scaffold copying
- A preview/rendering mechanism must exist in at least one client
