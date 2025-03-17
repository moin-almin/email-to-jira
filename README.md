# Email to Jira

A browser extension that allows you to create Jira tickets directly from email content in Gmail and Outlook.

## Features

- Extract email data from Gmail and Outlook
- Create Jira tickets with data from emails
- Customize ticket fields and templates
- Save your Jira credentials securely
- Configure default settings and templates

## Installation

### Chrome / Edge

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and should appear in your browser toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..." and select any file in the extension directory
4. The extension is now installed temporarily and should appear in your browser toolbar

## Getting Started

1. Click the extension icon in your browser toolbar
2. Enter your Jira credentials (URL, email, and API token)
3. Navigate to an email in Gmail or Outlook
4. Click the extension icon to open the popup
5. Click "Extract from Email" to populate the form with email data
6. Add your project key and any other details
7. Click "Create Ticket" to create a new Jira ticket

## Obtaining a Jira API Token

To use this extension, you'll need to generate an API token for your Atlassian account:

1. Log in to [Atlassian](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Enter a label for your token (e.g., "Email to Jira Extension")
4. Click "Create"
5. Copy the generated token to use in the extension

## Permissions

This extension requires the following permissions:

- `activeTab`: To access the current tab for email data extraction
- `storage`: To save your Jira credentials and preferences
- `tabs`: To detect when you're viewing an email

## Privacy

Your Jira credentials and API token are stored locally in your browser using `chrome.storage.sync`. They are never sent to any server other than your Jira instance.

## Development

### Project Structure

```
email-to-jira/
├── manifest.json       # Extension manifest
├── popup.html          # Popup UI
├── popup.js            # Popup logic
├── options.html        # Options page
├── options.js          # Options logic
├── background.js       # Background script
├── content.js          # Content script for email extraction
├── css/                # CSS stylesheets
│   ├── popup.css       # Popup styles
│   └── options.css     # Options page styles
└── icons/              # Extension icons
```

### Building for Production

For production use, you may want to:

1. Minify JavaScript and CSS files
2. Generate production-ready zip file
3. Submit to browser extension stores

## Troubleshooting

- **Can't extract email data**: Make sure you have an email open in Gmail or Outlook
- **Connection errors**: Verify your Jira URL and API token are correct
- **Permission issues**: Make sure you have the necessary permissions in Jira to create issues

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

Icons created using [Jira](https://www.atlassian.com/software/jira) brand assets. 