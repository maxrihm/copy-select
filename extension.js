const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let selectionsJSON = {};
const jsonFilePath = path.join(__dirname, 'selections.json');

const saveSelectionsToFile = () => {
    try {
        Object.keys(selectionsJSON).forEach(filePath => {
            selectionsJSON[filePath].sort((a, b) => a.startLine - b.startLine);
        });
        fs.writeFileSync(jsonFilePath, JSON.stringify(selectionsJSON, null, 2), 'utf8');
    } catch (error) {
        console.error(`Failed to write JSON file: ${error.message}`);
    }
};

function activate(context) {
    const selectionProvider = new SelectionProvider();
    
    const refreshMenu = () => {
        selectionProvider.refresh();
    };
    
    if (fs.existsSync(jsonFilePath)) {
        const fileData = fs.readFileSync(jsonFilePath, 'utf8');
        selectionsJSON = JSON.parse(fileData);
        refreshMenu();
    }

    let highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255,165,0,0.5)'
    });

    const updateHighlights = (editor) => {
        const filePath = editor.document.fileName;
        const selections = selectionsJSON[filePath];
        if (!selections || selections.length === 0) {
            editor.setDecorations(highlightDecorationType, []);
            return;
        }

        const decorationsArray = selections.map(sel => {
            const range = new vscode.Range(sel.startLine, 0, sel.endLine, 9999);
            return { range };
        });

        editor.setDecorations(highlightDecorationType, decorationsArray);
    };

    vscode.window.visibleTextEditors.forEach(editor => {
        const filePath = editor.document.fileName;
        if (selectionsJSON[filePath]) {
            updateHighlights(editor);
        }
    });

    vscode.workspace.onDidOpenTextDocument((doc) => {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
        if (editor) {
            updateHighlights(editor);
        }
    });

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
        refreshMenu();
        updateHighlights(editor);
    });

    let unselectRangeCommand = vscode.commands.registerCommand('extension.unselectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;

        if (selectionsJSON[filePath]) {
            selectionsJSON[filePath] = selectionsJSON[filePath].filter(sel => {
                return !(startLine <= sel.endLine && endLine >= sel.startLine);
            });

            if (selectionsJSON[filePath].length === 0) {
                delete selectionsJSON[filePath];
            }

            saveSelectionsToFile();
            refreshMenu();
            updateHighlights(editor);
        }
    });

    let unselectAllCommand = vscode.commands.registerCommand('extension.unselectAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const filePath = editor.document.fileName;

        if (selectionsJSON[filePath]) {
            delete selectionsJSON[filePath];
            saveSelectionsToFile();
            refreshMenu();
            updateHighlights(editor);
        }
    });

    let copySelectedTextCommand = vscode.commands.registerCommand('extension.copySelectedText', () => {
        let selectedText = '';
        Object.keys(selectionsJSON).forEach(filePath => {
            const selections = selectionsJSON[filePath];
            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);

            if (editor) {
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

    context.subscriptions.push(selectRangeCommand);
    context.subscriptions.push(unselectRangeCommand);
    context.subscriptions.push(unselectAllCommand);
    context.subscriptions.push(copySelectedTextCommand);

    vscode.window.registerTreeDataProvider('selectionView', selectionProvider);

    let openFileCommand = vscode.commands.registerCommand('extension.openFile', (filePath) => {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    });

    let unselectFileCommand = vscode.commands.registerCommand('extension.unselectFile', (filePath) => {
        if (selectionsJSON[filePath]) {
            delete selectionsJSON[filePath];
            saveSelectionsToFile();
            refreshMenu();

            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
            if (editor) {
                updateHighlights(editor);
            }
        }
    });

    let deleteFileSelectionCommand = vscode.commands.registerCommand('extension.deleteFileSelection', (file) => {
        const filePath = file.filePath;
    
        if (selectionsJSON[filePath]) {
            delete selectionsJSON[filePath];
            saveSelectionsToFile();
            refreshMenu();
    
            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
            if (editor) {
                updateHighlights(editor);
            }
    
            vscode.window.showInformationMessage(`Selections cleared for file: ${filePath}`);
        } else {
            vscode.window.showInformationMessage(`No selections found for file: ${filePath}`);
        }
    });

    context.subscriptions.push(openFileCommand);
    context.subscriptions.push(unselectFileCommand);
    context.subscriptions.push(deleteFileSelectionCommand);

    let debugFilePathCommand = vscode.commands.registerCommand('extension.debugFilePath', (file) => {
        const filePath = file.filePath;
        vscode.window.showInformationMessage(`Debug: filePath is ${filePath}`);
    });
    context.subscriptions.push(debugFilePathCommand);
}

function deactivate() {}

class SelectionProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren(element) {
        if (!element) {
            return Object.keys(selectionsJSON).map(file => {
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
            treeItem.resourceUri = vscode.Uri.file(element.filePath);
        }

        return treeItem;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

vscode.workspace.onDidChangeTextDocument((event) => {
    const filePath = event.document.fileName;

    if (!selectionsJSON[filePath]) {
        return;
    }

    event.contentChanges.forEach(change => {
        const startLine = change.range.start.line;
        const endLine = change.range.end.line;
        const lineDelta = change.text.split('\n').length - (endLine - startLine + 1);

        selectionsJSON[filePath] = selectionsJSON[filePath].map(selection => {
            if (selection.startLine > endLine) {
                selection.startLine += lineDelta;
                selection.endLine += lineDelta;
            } else if (selection.endLine >= startLine) {
                if (startLine <= selection.startLine) {
                    selection.startLine = Math.max(0, selection.startLine + lineDelta);
                }
                selection.endLine = Math.max(selection.startLine, selection.endLine + lineDelta);
            }

            const selectedText = event.document.getText(new vscode.Range(selection.startLine, 0, selection.endLine, 9999));
            selection.content = selectedText;

            return selection;
        });

        try {
            saveSelectionsToFile();
        } catch (error) {
            console.error(`Error writing JSON file: ${error.message}`);
        }

        const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === filePath);
        if (editor) {
            updateHighlights(editor);
        }
    });
});

module.exports = {
    activate,
    deactivate
};
