# Chroma Shift
### A rule-based color transformation puzzle built around state, cost, and route optimization

Chroma Shift is an interactive browser prototype that turns color manipulation into a small, deterministic planning problem. Instead of treating color as a purely visual choice, the game models each color as a state in a structured space and asks the player to reach a target through a sequence of transformations.

The project explores a simple but useful interaction-design question: **how can a visual interface make the consequences of an action understandable before the user commits to it?**

## Project overview

The player starts with one color and must transform it into a target color using a limited set of operations. Every move has explicit rules and contributes to run statistics. Different routes can reach the same destination, but they can differ in number of moves, action cost, and distance travelled through the modeled color space.

The interface combines a color wheel, current and target color cards, move controls, live statistics, and a trace of the decisions taken. A move can be previewed before it is applied, allowing the player to inspect its expected effect and then decide whether to commit.

## Core mechanics

- **Structured color space:** 30 evenly spaced hue positions and five represented shade levels.
- **Shader operations:** Bright and Dark move one shade level at a time.
- **Inversion:** moves to the opposite hue while reversing the shade level.
- **Parameterized mixing:** choose Red, Green, or Blue as a primary color and select a ratio. The ratio controls how far the hue moves toward the selected primary along the shortest circular path.
- **Preview before commit:** hover or focus a move to see its projected result on the color wheel.
- **Route tracking:** each applied operation is recorded in a trace so the transformation sequence remains inspectable.
- **Multiple optimization signals:** Moves counts actions, Cost totals their configured prices, and Path distance estimates how far the state travelled through the modeled hue-and-shade space.
- **Progress persistence:** best results are stored locally in the browser.

## Modes

### Level
A guided starting scenario with a fixed starting color and target. It introduces the transformation rules and provides a baseline for comparing routes.

### Hard Level
A route-selection challenge with multiple starting states. The alternatives encourage different strategies, including a low-cost mixing route and an inversion-based route.

### Free Play
A sandbox mode that generates a color pair so the player can experiment with the transformation system without the fixed level objective.

## Design and engineering focus

Chroma Shift is intentionally small in scope, but its mechanics are built around several ideas relevant to interactive product development:

- **State modeling:** colors and terminal states are represented explicitly, and actions transform the current state according to defined rules.
- **Circular-domain calculations:** hue movement accounts for wrap-around and chooses the shortest direction around the wheel.
- **Action previewing:** the same transformation logic informs both the preview and the committed move, helping keep feedback consistent with behavior.
- **Trade-off visibility:** the interface exposes several measures of a route instead of reducing success to a single score.
- **Interaction feedback:** current state, target state, selected mixing parameters, action history, and completion status are reflected in the UI.
- **Incremental interface composition:** the board is organized into focused areas for state comparison, spatial visualization, controls, metrics, and history.

These choices make the prototype a compact exercise in translating a rule system into an interface that people can explore, understand, and reason about.

## How to play

1. Inspect the starting color and the target.
2. Choose a transformation, or select a primary color and ratio for mixing.
3. Preview a move by hovering over or focusing the relevant control.
4. Apply the move when its effect fits your intended route.
5. Compare the move count, total cost, and path distance, then review the trace.
6. Use Reset or switch modes to try a different strategy.

### Mixing ratios

A ratio is interpreted as **current color : selected primary color**. For example, `3:1` has a smaller effect than `1:3`, because the selected primary contributes a larger share in the latter. Ratios are ordered from lower to higher expected influence of the selected primary.

Mixing also moves the shade one step toward neutral. Hue movement follows the shortest route around the circular hue model, so the exact distance depends on the current hue and the chosen primary.

## Run locally

No build step or package installation is required for the current prototype.

1. Clone or download this repository.
2. Keep `index.html`, `script.js`, and the stylesheet in the same directory.
3. Open `index.html` in a modern browser.

If you prefer to serve it locally, run any static file server from the project directory.

## Implementation

- **HTML** for the page structure and accessible control labels.
- **CSS** for the visual system, layout, and interaction states.
- **Vanilla JavaScript** for state transitions, hue calculations, scoring, preview logic, and rendering.
- **SVG** for the color-wheel visualization and state markers.
- **localStorage** for retaining best results in the current browser.

## Current scope and limitations

Chroma Shift is an experimental prototype, not a professional color-management tool or a physically accurate pigment-mixing simulator. Its hue and shade values belong to a deliberately simplified game model. The mixing operation interpolates hue in that model; it does not simulate real-world paint, light, or perceptual color science.

The current experience focuses on a small set of scenarios and a compact transformation system. Potential future directions include a level editor, configurable transformation rules, additional challenge objectives, solution comparison, and more systematic automated testing.

## Why this project

The project is an exploration of how to make an abstract rule system tangible through a visual product. It brings together interaction design, deterministic logic, parameterized actions, immediate feedback, and measurable outcomes in a form that can be understood quickly and extended over time.

For a Solution Engineer, the same pattern is useful beyond games: understand the problem domain, model the rules, expose meaningful controls, demonstrate outcomes, and help users compare possible approaches before committing to one.

---

*Built as an independent browser-based project. The current repository represents a working prototype and an evolving exploration of interactive problem-solving.*
