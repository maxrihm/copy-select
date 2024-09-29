const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let selectionsJSON = {};
const jsonFilePath = path.join(__dirname, 'selections.json');

const saveSelectionsToFile = () => {
    try {
        fs.writeFileSync(jsonFilePath, JSON.stringify(selectionsJSON, null, 2), 'utf8');
        console.log(`JSON file updated at path: ${jsonFilePath}`);
    } catch (error) {
        console.error(`Failed to write JSON file: ${error.message}`);
    }
};

function activate(context) {
    if (fs.existsSync(jsonFilePath)) {
        const fileData = fs.readFileSync(jsonFilePath, 'utf8');
        selectionsJSON = JSON.parse(fileData);
    }

    // Decoration for highlighted range (color: orange)
    let highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255,165,0,0.5)'
    });

    const updateHighlights = (editor) => {
        const filePath = editor.document.fileName;
        const selections = selectionsJSON[filePath];
        if (!selections || selections.length === 0) {
            editor.setDecorations(highlightDecorationType, []); // Clear decorations
            return;
        }

        const decorationsArray = selections.map(sel => {
            const range = new vscode.Range(sel.startLine, 0, sel.endLine, 9999);
            return { range };
        });

        editor.setDecorations(highlightDecorationType, decorationsArray);
    };

    let selectRangeCommand = vscode.commands.registerCommand('extension.selectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;
        const selectedText = editor.document.getText(new vscode.Range(startLine, 0, endLine, 9999));

        const overlapsExistingSelection = selectionsJSON[filePath]?.some(sel => {
            return (startLine >= sel.startLine && startLine <= sel.endLine) ||
                   (endLine >= sel.startLine && endLine <= sel.endLine) ||
                   (startLine <= sel.startLine && endLine >= sel.endLine);
        });

        if (overlapsExistingSelection) {
            vscode.window.showInformationMessage("This range or part of it is already selected.");
            return;
        }

        if (!selectionsJSON[filePath]) {
            selectionsJSON[filePath] = [];
        }

        selectionsJSON[filePath].push({ startLine, endLine, content: selectedText });
        saveSelectionsToFile();
        updateHighlights(editor);
        selectionProvider.refresh();  // Refresh the tree view
    });

    // Command: Unselect a range (even if partially selected)
    let unselectRangeCommand = vscode.commands.registerCommand('extension.unselectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;

        if (selectionsJSON[filePath]) {
            // Unselect the entire range if the current selection overlaps with any existing range
            selectionsJSON[filePath] = selectionsJSON[filePath].filter(sel => {
                return !(startLine <= sel.endLine && endLine >= sel.startLine); // Remove if overlapping
            });

            // If no selections remain for this file, remove it from JSON
            if (selectionsJSON[filePath].length === 0) {
                delete selectionsJSON[filePath];
            }

            saveSelectionsToFile();
            updateHighlights(editor);
            selectionProvider.refresh();  // Refresh the tree view
        }
    });

    // Command: Unselect all ranges in the file
    let unselectAllCommand = vscode.commands.registerCommand('extension.unselectAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const filePath = editor.document.fileName;

        if (selectionsJSON[filePath]) {
            delete selectionsJSON[filePath];  // Remove all selections for the file
            saveSelectionsToFile();
            updateHighlights(editor);
            selectionProvider.refresh();  // Refresh the tree view
        }
    });

    // Command: Copy selected text in top-to-bottom order
    let copySelectedTextCommand = vscode.commands.registerCommand('extension.copySelectedText', () => {
        let selectedText = '';
        Object.keys(selectionsJSON).forEach(filePath => {
            const selections = selectionsJSON[filePath];
            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);

            if (editor) {
                // Sort selections by their start line number to ensure top-to-bottom copying
                selections.sort((a, b) => a.startLine - b.startLine);

                selections.forEach(sel => {
                    const text = editor.document.getText(new vscode.Range(sel.startLine, 0, sel.endLine, 9999));
                    selectedText += text + '\n';
                });
            }
        });

        vscode.env.clipboard.writeText(selectedText.trim());
    });

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            updateHighlights(editor);
        }
    });

    vscode.workspace.onDidOpenTextDocument((doc) => {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
        if (editor) {
            updateHighlights(editor);
        }
    });

    // Register all commands
    context.subscriptions.push(selectRangeCommand);
    context.subscriptions.push(unselectRangeCommand);
    context.subscriptions.push(unselectAllCommand);
    context.subscriptions.push(copySelectedTextCommand);

    // Tree view for Selection Explorer
    let selectionProvider = new SelectionProvider();
    vscode.window.registerTreeDataProvider('selectionView', selectionProvider);

    let openFileCommand = vscode.commands.registerCommand('extension.openFile', (filePath) => {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    });

    // Command to unselect all selections for a specific file via context menu
    let unselectFileCommand = vscode.commands.registerCommand('extension.unselectFile', (filePath) => {
        if (selectionsJSON[filePath]) {
            delete selectionsJSON[filePath];
            saveSelectionsToFile();
            selectionProvider.refresh();

            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
            if (editor) {
                updateHighlights(editor);
            }
        }
    });

    let deleteFileSelectionCommand = vscode.commands.registerCommand('extension.deleteFileSelection', (file) => {
        const filePath = file.filePath;  // Extract the filePath from the passed object
    
        console.log('Deleting selections for:', filePath);
        if (selectionsJSON[filePath]) {
            delete selectionsJSON[filePath];
            saveSelectionsToFile();
            selectionProvider.refresh();
    
            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
            if (editor) {
                updateHighlights(editor);
                console.log('Selections and highlights removed for:', filePath);
            } else {
                console.log('Selections removed but file not open in editor:', filePath);
            }
    
            vscode.window.showInformationMessage(`Selections cleared for file: ${filePath}`);
        } else {
            vscode.window.showInformationMessage(`No selections found for file: ${filePath}`);
        }
    });

    context.subscriptions.push(openFileCommand);
    context.subscriptions.push(unselectFileCommand);
    context.subscriptions.push(deleteFileSelectionCommand);
}

function deactivate() {}

// Tree Data Provider for Selection Explorer
class SelectionProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren(element) {
        if (!element) {
            return Object.keys(selectionsJSON).map(file => {
                // Use relative paths instead of full paths
                const relativePath = vscode.workspace.asRelativePath(file);
                return {
                    label: relativePath,
                    filePath: file,
                    type: 'file'
                };
            });
        }
        return [];
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);

        if (element.type === 'file') {
            treeItem.contextValue = 'file';
            treeItem.command = {
                command: 'extension.openFile',
                title: "Open File",
                arguments: [element.filePath]
            };
        }

        return treeItem;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = {
    activate,
    deactivate
};

// Document change tracking
vscode.workspace.onDidChangeTextDocument((event) => {
    const filePath = event.document.fileName;

    if (!selectionsJSON[filePath]) {
        return; // No selections for this file, so nothing to update
    }

    console.log('Document change detected'); // Debugging

    event.contentChanges.forEach(change => {
        const startLine = change.range.start.line;
        const endLine = change.range.end.line;
        const lineDelta = change.text.split('\n').length - (endLine - startLine + 1);

        console.log(`Line change detected: start=${startLine}, end=${endLine}, delta=${lineDelta}`); // Debugging

        // Adjust the selection ranges and update the content
        selectionsJSON[filePath] = selectionsJSON[filePath].map(selection => {
            // Shift selections if change happens before or inside the selection
            if (selection.startLine > endLine) {
                selection.startLine += lineDelta;
                selection.endLine += lineDelta;
            } else if (selection.endLine >= startLine) {
                if (startLine <= selection.startLine) {
                    selection.startLine = Math.max(0, selection.startLine + lineDelta);
                }
                selection.endLine = Math.max(selection.startLine, selection.endLine + lineDelta);
            }

            // Update the content of the selection
            const selectedText = event.document.getText(new vscode.Range(selection.startLine, 0, selection.endLine, 9999));
            selection.content = selectedText;

            console.log(`Selection updated: start=${selection.startLine}, end=${selection.endLine}, content=${selection.content}`); // Debugging

            return selection;
        });

        // Ensure that the updated selections are written to the JSON file
        try {
            console.log('Attempting to write to JSON file...'); // Debugging
            saveSelectionsToFile(); // Call the function to save to the file
            console.log('JSON file updated after document change'); // Confirm file write success
        } catch (error) {
            console.error(`Error writing JSON file: ${error.message}`); // Debugging for write failure
        }

        // Refresh highlights in the editor
        const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
        if (editor) {
            updateHighlights(editor);
        }

        console.log('Selections and highlights updated after document change'); // Debugging
    });
});
