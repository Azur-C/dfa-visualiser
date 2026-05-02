# DFA Visualiser

Live demo: https://dfa-visualiser.vercel.app/

DFA Visualiser is a web application for creating, editing, viewing, and transforming deterministic finite automata (DFAs).

It supports both graphical editing on a canvas and structured editing in text form, making it useful for building automata, checking their structure, and exporting the results.

## Features

- Create and edit DFAs visually
- Edit DFAs in text mode
- Switch between classic and symbolic input modes
- Validate DFAs and highlight common issues
- Generate random DFAs
- Run DFA operations: complement, minimisation, union, and intersection
- Import DFAs from JSON
- Export DFAs as JSON, SVG, or PNG
- Work with multiple DFA panels in one workspace

## Input Modes

### Classic Mode

Classic mode uses single lowercase letters or digits as transition symbols.

Examples:

- `a`
- `b`
- `0`

### Symbolic Mode

Symbolic mode supports predicate-style labels over the fixed domain `[a-z][0-9]`.

Examples:

- `letter`
- `digit`
- `alnum`
- `[a-z]`
- `[0-9]`
- `[a-f]`
- `not digit`

## Running the Project

### Requirements

- Node.js
- npm

### Install Dependencies

```bash
npm install
```

### Start the Development Server

```bash
npm run dev
```

### Build the Project

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

### Run Linting

```bash
npm run lint
```

## Project Structure

```text
dfa-editor/
|-- public/                  Static assets
|-- src/
|   |-- appearance/          Theme and appearance helpers
|   |-- components/          UI components and dialogs
|   |-- dfa-core/            DFA logic and algorithms
|   |-- io/                  Import and export helpers
|   |-- styles/              CSS styles
|   |-- symbolic/            Symbolic parsing and operations
|   |-- text/                Text-mode form logic
|   |-- utils/               Shared utilities
|   |-- visualization/       Graph and export rendering
|   |-- workspace/           Workspace and history state
|   |-- App.tsx              Main application
|   `-- main.tsx             Entry point
|-- index.html
|-- package.json
`-- vite.config.ts
```

## Limits

- The workspace supports up to 4 DFA panels.
- A single DFA supports up to 100 states.
