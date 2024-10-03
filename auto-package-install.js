const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const packageExtension = () => {
  console.log('Packaging the extension...');
  exec('vsce package', (err, stdout, stderr) => {
    if (err) {
      console.error(`Error packaging extension: ${stderr}`);
      return;
    }

    const vsixFile = stdout.match(/(\S+\.vsix)/)[1];
    console.log(`Packaged extension as ${vsixFile}`);
    installExtension(vsixFile);
  });
};

const installExtension = (vsixFile) => {
  console.log(`Installing ${vsixFile} in VS Code...`);
  exec(`code --install-extension ${vsixFile} --force`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error installing extension: ${stderr}`);
      return;
    }

    console.log('Extension installed successfully!');
    reloadVSCode();
  });
};

const reloadVSCode = () => {
  console.log('Reloading VS Code window...');
  exec('code --reload-window', (err, stdout, stderr) => {
    if (err) {
      console.error(`Error reloading VS Code window: ${stderr}`);
      return;
    }

    console.log('VS Code window reloaded.');
  });
};

packageExtension();
