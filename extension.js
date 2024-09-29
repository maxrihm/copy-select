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

    // Update the color to orange
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

    const findSelectionIndex = (filePath, startLine, endLine) => {
        if (!selectionsJSON[filePath]) return -1;

        return selectionsJSON[filePath].findIndex(sel => sel.startLine === startLine && sel.endLine === endLine);
    };

    let selectRangeCommand = vscode.commands.registerCommand('extension.selectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;

        // Check if the range is already selected (highlighted)
        const selectionIndex = findSelectionIndex(filePath, startLine, endLine);
        if (selectionIndex !== -1) {
            // If it's already selected, remove it
            selectionsJSON[filePath].splice(selectionIndex, 1);
        } else {
            if (!selectionsJSON[filePath]) {
                selectionsJSON[filePath] = [];
            }
            selectionsJSON[filePath].push({ startLine, endLine });
        }

        saveSelectionsToFile();
        updateHighlights(editor);
    });

    let unselectRangeCommand = vscode.commands.registerCommand('extension.unselectRange', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        const filePath = editor.document.fileName;

        if (selectionsJSON[filePath]) {
            // Unselect all ranges that overlap with the current selection or unselect everything if the current selection is Ctrl+A (Select All)
            selectionsJSON[filePath] = selectionsJSON[filePath].filter(sel => {
                return !(sel.startLine >= startLine && sel.endLine <= endLine);
            });

            saveSelectionsToFile();
            updateHighlights(editor);
        }
    });

    let unselectAllCommand = vscode.commands.registerCommand('extension.unselectAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const filePath = editor.document.fileName;

        // Remove all selections from the current file
        if (selectionsJSON[filePath]) {
            selectionsJSON[filePath] = [];
            saveSelectionsToFile();
            updateHighlights(editor);
        }
    });

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

    context.subscriptions.push(selectRangeCommand);
    context.subscriptions.push(unselectRangeCommand);
    context.subscriptions.push(unselectAllCommand);
    context.subscriptions.push(copySelectedTextCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
