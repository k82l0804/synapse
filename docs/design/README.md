# Synapse Dashboard — Design Mockups

UI mockups generated during architecture discussions. Updated as design evolves.

## Tab Structure (v0.4)

```
Pipeline | Sprints | Sprint | Backlog | Features | Reviews
```

## Mockup History

| File | Tab | What it shows |
|------|-----|--------------|
| mockup-v0.1-dashboard-kanban.jpg | Sprint (early) | First cut: kanban + right dossier panel |
| mockup-v0.2-dashboard-pipeline-tab.jpg | Pipeline | React Flow graph, no central scheduler |
| mockup-v0.3-sprints-list.jpg | Sprints | Ordered list of phases: current + done collapsed |
| mockup-v0.4-sprint-kanban.jpg | Sprint | TODO / IN PROGRESS / DONE kanban + plans section |

## Still Needed

- [ ] Backlog tab — deferred tasks, priority-ordered, promote-to-sprint action
- [ ] Features tab — feature list + dossier right panel (spec + tests rendered inline)
- [ ] Reviews tab — review + triage docs list, rendered markdown
- [ ] Products tab — portfolio management (add/archive/start/stop)

## Design Principles

- Dark mode: #0F1117 background, electric blue #4F8EF7 accents
- Color = status: green=done, blue=in-progress, gray=todo, amber=gate waiting
- File-backed: all content is markdown rendered via react-markdown + shiki
- file:// links open in editor (not browser)
- Right panel = dossier: click any item, details render in 320px right panel
- No task creation forms: tasks created in IDE by agents, GUI is read/control only
