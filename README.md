# Copy Select Extension

This extension allows you to manage and manipulate text selections within VS Code. It provides the following commands:

## Commands

- **Select Range (Ctrl+Shift+S):** Select a range of lines in the current file.
- **Unselect Range (Ctrl+Shift+U):** Unselect a previously selected range.
- **Copy Selected Text (Ctrl+Shift+C):** Copy all selected ranges in the current file.
- **Unselect All (Ctrl+Shift+A):** Unselect all selected ranges in the current file.
- **Open File:** Open a file from the selection explorer.
- **Delete Selections in This File:** Delete all selections for the currently open file.

## Keybindings

The extension provides the following default keybindings:
- **Ctrl+Shift+S:** Select a range.
- **Ctrl+Shift+U:** Unselect a range.
- **Ctrl+Shift+C:** Copy selected text.
- **Ctrl+Shift+A:** Unselect all ranges.

## Packaging and Installing the Extension

To automate the process of packaging, installing, and reloading the extension after making changes, follow these steps:

### Option 1: Using the Command Palette

1. Press `Ctrl+Shift+P` to open the **Command Palette**.
2. Type `"Tasks: Run Task"` and select it.
3. From the list of tasks, choose `"Package and Install Extension"`.
4. The task will package the extension, install it, and reload VS Code automatically.

### Option 2: Using a Custom Keybinding (Optional)

1. You can bind the task to a custom key for even quicker access. Here's how to do it:
   - Open your `keybindings.json` by pressing `Ctrl+Shift+P` and typing `"Preferences: Open Keyboard Shortcuts (JSON)"`.
   - Add the following configuration:

   ```json
   {
     "key": "ctrl+alt+p",  // or any keybinding you prefer
     "command": "workbench.action.tasks.runTask",
     "args": "Package and Install Extension"
   }
