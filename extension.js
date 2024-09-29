const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let selectionsJSON = {};
const jsonFilePath = path.join(__dirname, 'selections.json');

function activate(context) {
    if (fs.existsSync(jsonFilePath)) {
        const fileData = fs.readFileSync(jsonFilePath, 'utf8');
        selectionsJSON = JSON.parse(fileData);
    }

    // Decoration for highlighted range (color: orange)
    let highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255,165,0,0.5)'
    });

    const saveSelectionsToFile = () => {
        fs.writeFileSync(jsonFilePath, JSON.stringify(selectionsJSON, null, 2), 'utf8');
    };

    const updateHighlights = (editor) => {
        const filePath = editor.document.fileName;
        const selections = selectionsJSON[filePath];
        if (!selections) return;

        const decorationsArray = selections.map(sel => {
            const range = new vscode.Range(sel.startLine, 0, sel.endLine, 9999);
            return { range };
        });

        editor.setDecorations(highlightDecorationType, decorationsArray);
    };

    // Command: Select a range
    let selectRangeCommand = vscode.commands.registerCommand('extension.selectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;

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

        selectionsJSON[filePath].push({ startLine, endLine });
        saveSelectionsToFile();
        updateHighlights(editor);
        selectionProvider.refresh();  // Refresh the tree view
    });

    // Command: Unselect a range
    let unselectRangeCommand = vscode.commands.registerCommand('extension.unselectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;

        if (selectionsJSON[filePath]) {
            selectionsJSON[filePath] = selectionsJSON[filePath].filter(sel => {
                return !(sel.startLine >= startLine && sel.endLine <= endLine);
            });

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
            selectionsJSON[filePath] = [];
            saveSelectionsToFile();
            updateHighlights(editor);
            selectionProvider.refresh();  // Refresh the tree view
        }
    });

    // Command: Copy selected text
    let copySelectedTextCommand = vscode.commands.registerCommand('extension.copySelectedText', () => {
        let selectedText = '';
        Object.keys(selectionsJSON).forEach(filePath => {
            const selections = selectionsJSON[filePath];
            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);

            if (editor) {
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

    let unselectFileCommand = vscode.commands.registerCommand('extension.unselectFile', (filePath) => {
        if (selectionsJSON[filePath]) {
            selectionsJSON[filePath] = [];
            saveSelectionsToFile();
            selectionProvider.refresh();

            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
            if (editor) {
                updateHighlights(editor);
            }
        }
    });

    let deleteFileSelectionCommand = vscode.commands.registerCommand('extension.deleteFileSelection', (filePath) => {
        delete selectionsJSON[filePath];
        saveSelectionsToFile();
        selectionProvider.refresh();

        const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
        if (editor) {
            updateHighlights(editor);
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
                return {
                    label: file,
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
                arguments: [element.label]
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
