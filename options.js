document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const jiraUrlInput = document.getElementById('jira-url');
  const apiTokenInput = document.getElementById('api-token');
  const emailInput = document.getElementById('email');
  const defaultProjectInput = document.getElementById('default-project');
  const defaultIssueTypeSelect = document.getElementById('default-issue-type');
  const emailTemplateInput = document.getElementById('email-template');
  const customFieldsInput = document.getElementById('custom-fields');
  const includeAttachmentsCheckbox = document.getElementById('include-attachments');
  const testConnectionBtn = document.getElementById('test-connection');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const connectionStatus = document.getElementById('connection-status');

  // Load saved settings
  loadSettings();

  // Event listeners
  testConnectionBtn.addEventListener('click', testConnection);
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get({
      // Default values
      jiraUrl: '',
      apiToken: '',
      email: '',
      defaultProject: '',
      defaultIssueType: 'Task',
      emailTemplate: 'From: {from}\nTo: {to}\nDate: {date}\n\n----- Email Content -----\n\n{body}',
      customFields: '{}',
      includeAttachments: false
    }, function(items) {
      jiraUrlInput.value = items.jiraUrl;
      apiTokenInput.value = items.apiToken;
      emailInput.value = items.email;
      defaultProjectInput.value = items.defaultProject;
      defaultIssueTypeSelect.value = items.defaultIssueType;
      emailTemplateInput.value = items.emailTemplate;
      customFieldsInput.value = items.customFields;
      includeAttachmentsCheckbox.checked = items.includeAttachments;
    });
  }

  // Save settings to storage
  function saveSettings() {
    // Validate custom fields JSON
    let customFields = {};
    try {
      if (customFieldsInput.value.trim()) {
        customFields = JSON.parse(customFieldsInput.value);
      }
    } catch (e) {
      alert('Invalid JSON in Custom Fields. Please check the format.');
      return;
    }

    // Save all settings
    chrome.storage.sync.set({
      jiraUrl: jiraUrlInput.value.trim(),
      apiToken: apiTokenInput.value.trim(),
      email: emailInput.value.trim(),
      defaultProject: defaultProjectInput.value.trim(),
      defaultIssueType: defaultIssueTypeSelect.value,
      emailTemplate: emailTemplateInput.value,
      customFields: customFieldsInput.value,
      includeAttachments: includeAttachmentsCheckbox.checked
    }, function() {
      // Show save confirmation
      const saveConfirmation = document.createElement('div');
      saveConfirmation.className = 'success';
      saveConfirmation.textContent = 'Settings saved successfully!';
      
      // Insert after the actions div
      const actionsDiv = document.querySelector('.actions');
      actionsDiv.insertAdjacentElement('afterend', saveConfirmation);
      
      // Remove the message after 3 seconds
      setTimeout(() => {
        saveConfirmation.remove();
      }, 3000);
    });
  }

  // Reset settings to defaults
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      chrome.storage.sync.set({
        defaultProject: '',
        defaultIssueType: 'Task',
        emailTemplate: 'From: {from}\nTo: {to}\nDate: {date}\n\n----- Email Content -----\n\n{body}',
        customFields: '{}',
        includeAttachments: false
      }, function() {
        // Reload settings
        loadSettings();
        
        // Show reset confirmation
        const resetConfirmation = document.createElement('div');
        resetConfirmation.className = 'success';
        resetConfirmation.textContent = 'Settings reset to defaults!';
        
        // Insert after the actions div
        const actionsDiv = document.querySelector('.actions');
        actionsDiv.insertAdjacentElement('afterend', resetConfirmation);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
          resetConfirmation.remove();
        }, 3000);
      });
    }
  }

  // Test Jira connection
  function testConnection() {
    const jiraUrl = jiraUrlInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    const email = emailInput.value.trim();

    if (!jiraUrl || !apiToken || !email) {
      showConnectionStatus('Please fill in all Jira connection fields.', 'error');
      return;
    }

    // Validate URL format
    try {
      new URL(jiraUrl);
    } catch (_) {
      showConnectionStatus('Please enter a valid Jira URL.', 'error');
      return;
    }

    // Show loading state
    showConnectionStatus('Testing connection...', '');
    testConnectionBtn.disabled = true;

    // Use the Jira API to test the connection
    const url = `${jiraUrl}/rest/api/2/myself`;
    const auth = btoa(`${email}:${apiToken}`);

    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Connection failed. Please check your credentials.');
      }
      return response.json();
    })
    .then(data => {
      // Connection successful
      showConnectionStatus(`Connection successful! Logged in as ${data.displayName || data.name || email}`, 'success');
    })
    .catch(error => {
      // Connection failed
      showConnectionStatus(`Connection failed: ${error.message}`, 'error');
    })
    .finally(() => {
      testConnectionBtn.disabled = false;
    });
  }

  // Show connection status
  function showConnectionStatus(message, type) {
    connectionStatus.textContent = message;
    connectionStatus.className = type || '';
  }
}); 