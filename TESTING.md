# Email to Jira Extension Testing Guide

This document provides steps to manually test the "Email to Jira" extension, with a focus on the "Extract from email" functionality.

## Prerequisites

1. Install the extension in development mode:
   - Open Chrome/Edge browser
   - Go to the extensions page (`chrome://extensions/` or `edge://extensions/`)
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

## Testing "Extract from Email" Feature

### Gmail Testing

1. **Open Gmail in a browser tab**:
   - Navigate to `https://mail.google.com/`
   - Log in to your Gmail account

2. **Open a specific email**: 
   - Click on an email in your inbox to open it in the reading pane or in a full view
   - Make sure the email content is fully loaded

3. **Activate the extension**:
   - Click on the "Email to Jira" extension icon in the browser toolbar
   - Verify that the popup opens correctly

4. **Test extraction**:
   - If needed, enter Jira credentials and click "Save Credentials"
   - Click the "Extract from Email" button
   - Observe the browser console (F12 > Console tab) for detailed logging information
   - Check if the summary and description fields are populated with the email data

### Outlook Testing

1. **Open Outlook in a browser tab**:
   - Navigate to `https://outlook.live.com/` or `https://outlook.office.com/`
   - Log in to your Outlook account

2. **Open a specific email**:
   - Click on an email in your inbox to open it in the reading pane
   - Make sure the email content is fully loaded

3. **Activate the extension**:
   - Click on the "Email to Jira" extension icon
   - Verify that the popup opens correctly

4. **Test extraction**:
   - If needed, enter Jira credentials and click "Save Credentials"
   - Click the "Extract from Email" button
   - Observe the browser console (F12 > Console tab) for detailed logging information
   - Check if the summary and description fields are populated with the email data

## Troubleshooting

If the "Extract from Email" feature doesn't work:

1. **Check console logs**:
   - Open browser DevTools (F12 or right-click > Inspect)
   - Go to the Console tab
   - Look for any error messages or logs from the extension

2. **Verify email is open**:
   - Make sure you have an actual email open, not just the inbox view
   - The extension only works on individual email views

3. **Test with different emails**:
   - Different email formats might be parsed differently
   - Try with simple text emails and HTML-formatted emails

4. **Refresh the page**:
   - Sometimes Gmail/Outlook loads content dynamically
   - Refresh the page and try again after the email is fully loaded

5. **Check selectors**:
   - Gmail and Outlook occasionally update their UI
   - If extraction consistently fails, the selectors in content.js might need updating
   - Check the console logs for which selectors are being tried and which are failing

### Fixing "Receiving end does not exist" Error

If you encounter the error "Could not establish connection. Receiving end does not exist," try these steps:

1. **Reload the Gmail/Outlook page**:
   - Sometimes the content script doesn't load properly
   - Refresh the page completely (Ctrl+F5 or Cmd+Shift+R)

2. **Open email in its own tab**:
   - Gmail sometimes has issues with the reading pane
   - Try opening the email in its own tab (right-click > Open in new tab)

3. **Check extension permissions**:
   - Go to extension settings (chrome://extensions/)
   - Make sure the extension has permissions for mail.google.com or outlook.com

4. **Reinstall the extension**:
   - Remove the extension
   - Close and reopen the browser
   - Reinstall the extension

5. **Try a different browser profile**:
   - Create a new Chrome profile
   - Install the extension there and test

6. **Check for conflicts**:
   - Temporarily disable other extensions, especially email-related ones
   - Test again to see if there's a conflict

7. **Verify Gmail version**:
   - Check if you're using the new Gmail interface or classic
   - The selectors might need to be adjusted for different Gmail versions

## Manual Verification

When testing, manually verify that the following data is correctly extracted:

1. **Email subject** → Should appear in the "Summary" field
2. **Sender information** → Should appear in the description with "From:" prefix
3. **Recipients** → Should appear in the description with "To:" prefix
4. **Date/time** → Should appear in the description with "Date:" prefix
5. **Email body** → Should appear in the description after the header information

## Reporting Issues

When reporting issues with the extraction feature, please include:

1. Which email client you were using (Gmail or Outlook)
2. The browser console logs (F12 > Console, copy all logs)
3. Whether the email was HTML-formatted or plain text
4. What specific data failed to extract (subject, sender, body, etc.) 