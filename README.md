# menu

A personal terminal command launcher for macOS. `menu` replaces a large alias file with a searchable Ink UI backed by real PTYs, so long-running and interactive commands can keep running in the right-hand task pane.

The name is intentionally plain. Better candidates: `cmddeck`, `aliasdeck`, or `launchpad` if you want something less generic.

## Installation

From this repo, run this once:

```sh
npm run install-cli
```

After that, use it from anywhere:

```sh
menu
```

`npm link` registers the package's `bin` entry globally, so you do not need to add this app directory itself to `PATH`. If `menu` is still not found, your npm global bin directory is not on `PATH`; check it with:

```sh
npm prefix -g
```

The binary will be linked under that directory's `bin/` folder. Add that folder to your shell `PATH` once.

During development you can run:

```sh
npm run dev
```

## Adding Commands

Use the interactive command creator:

```sh
menu cmd
```

It asks for:

- Name
- Command
- Working directory
- Background behavior

If the name already exists, `menu cmd` tells you and asks whether to overwrite that command or enter a different name.

## Editing Config

Open the raw config file directly:

```sh
menu config
```

This creates the config file first if needed, then opens it with `$VISUAL`, `$EDITOR`, or `vi`.

## Config

On first run, `menu` creates an empty config at `~/.config/menu/commands.json` if it does not already exist.

Example config:

```json
[
  {
    "title": "List files",
    "command": "ls -la"
  },
  {
    "title": "Start API server",
    "command": "npm run dev",
    "cwd": "~/Sites/my-api",
    "background": true
  },
  {
    "title": "Run tests",
    "command": "npm test",
    "background": false
  }
]
```

### Fields:

- `title`: Label shown in the command list.
- `command`: Shell command to run.
- `cwd`: Optional working directory. Relative paths are resolved from the directory where `menu` was launched. If omitted, the command runs in the launch directory.
- `background`: Optional. When `true`, the command is immediately tracked as a background task. When `false`, it stays in the output pane. When omitted, `menu` waits about two seconds: commands that are still running move to the background task pane automatically.

You can override the config path with:

```sh
MENU_CONFIG=/path/to/commands.json menu
MENU_CONFIG=/path/to/commands.json menu cmd
```

## Keys

- Type to fuzzy-search commands.
- `up` / `down` or `ctrl-p` / `ctrl-n`: move selection.
- `enter`: run the selected command.
- `tab` / `shift-tab`: move focus between commands, output, and background tasks.
- `ctrl-r`: reload the config file.
- `ctrl-c`: quits from the command list, or sends `ctrl-c` to the focused foreground/background PTY.

When a background task is focused in the right pane, it expands and receives keyboard input directly.
