import * as vscode from 'vscode';
import { DashboardProvider } from './providers/DashboardProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('ORPT Extension is now active!');

    // Register the webview provider
    const provider = new DashboardProvider(context.extensionUri, context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'orpt.dashboard',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register command to show dashboard
    context.subscriptions.push(
        vscode.commands.registerCommand('orpt.showDashboard', () => {
            vscode.commands.executeCommand('workbench.view.extension.orpt-container');
        })
    );

    // Removed auto-show to respect lazy activation and user control
    // Use the "ORPT: Show ORPT Dashboard" command to open the view when desired.
}

export function deactivate() {
    console.log('ORPT Extension deactivated');
}
