document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const projectKeyInput = document.getElementById('project-key');
  const issueTypeSelect = document.getElementById('issue-type');
  const summaryInput = document.getElementById('summary');
  const descriptionInput = document.getElementById('description');
  const customFieldsContainer = document.getElementById('custom-fields-container');
  const showFieldFormatsBtn = document.getElementById('show-field-formats');
  const createTicketBtn = document.getElementById('create-ticket');
  const extractFromEmailBtn = document.getElementById('extract-from-email');
  const ticketStatus = document.getElementById('ticket-status');
  const optionsBtn = document.getElementById('options-btn');

  // Load saved credentials and preferences
  loadSavedData();

  // Extract info from current email
  extractFromEmailBtn.addEventListener('click', function() {
    // Show loading status
    showStatusMessage(ticketStatus, 'Extracting email data...', '');
    extractFromEmailBtn.disabled = true;
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showStatusMessage(ticketStatus, 'Error: No active tab found', 'error');
        extractFromEmailBtn.disabled = false;
        return;
      }
      
      const currentTab = tabs[0];
      const url = currentTab.url || '';
      
      // Check if we're on a supported email client
      const isGmail = url.includes('mail.google.com');
      const isOutlook = url.includes('outlook.office.com') || url.includes('outlook.live.com');
      
      if (!isGmail && !isOutlook) {
        showStatusMessage(ticketStatus, 'This feature only works with Gmail and Outlook. Please open an email in one of these services.', 'error');
        extractFromEmailBtn.disabled = false;
        return;
      }
      
      console.log('Sending extractEmailData message to tab', currentTab.id);
      
      // First, try to inject the content script to ensure it's loaded
      injectContentScript(currentTab.id, function() {
        // Then try to extract email data
        sendExtractRequest(currentTab.id);
      });
    });
  });
  
  // Function to inject content script
  function injectContentScript(tabId, callback) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected successfully');
      if (callback) callback();
    }).catch(error => {
      console.error('Error injecting content script:', error);
      extractFromEmailBtn.disabled = false;
      showStatusMessage(ticketStatus, 'Error: Could not inject content script. ' + error.message, 'error');
    });
  }
  
  // Function to send extract request to content script
  function sendExtractRequest(tabId) {
    // Send message to content script to extract email data
    chrome.tabs.sendMessage(tabId, { action: 'extractEmailData' }, function(response) {
      extractFromEmailBtn.disabled = false;
      
      // Check for communication errors
      if (chrome.runtime.lastError) {
        console.error('Error communicating with content script:', chrome.runtime.lastError);
        
        const errorMessage = chrome.runtime.lastError.message || 'Failed to communicate with the page.';
        
        // Provide detailed troubleshooting for connection issues
        if (errorMessage.includes('Receiving end does not exist')) {
          showStatusMessage(ticketStatus, 'Error: Cannot connect to email page. Try the following:', 'error');
          
          const helpText = document.createElement('div');
          helpText.innerHTML = '<ul style="margin-left: 20px; list-style-type: disc;">' +
                              '<li>Refresh the Gmail page</li>' +
                              '<li>Make sure you\'re viewing an individual email, not just the inbox</li>' +
                              '<li>If using Gmail, try viewing the email in its own tab</li>' +
                              '<li>Disable and re-enable the extension</li>' +
                              '<li>Try closing and reopening the browser</li>' +
                              '</ul>';
          
          ticketStatus.appendChild(helpText);
        } else {
          showStatusMessage(ticketStatus, 'Error: ' + errorMessage + ' Please reload the page and try again.', 'error');
        }
        return;
      }
      
      // Check if we got a valid response
      if (!response) {
        console.error('No response from content script');
        showStatusMessage(ticketStatus, 'Error: Content script did not respond. Please reload the page and try again.', 'error');
        return;
      }
      
      console.log('Received response from content script:', response);
      
      if (response.success) {
        summaryInput.value = response.subject || '';
        
        // Handle the promise returned by formatEmailToDescription
        formatEmailToDescription(response)
          .then(formattedDescription => {
            descriptionInput.value = formattedDescription;
            showStatusMessage(ticketStatus, 'Email data extracted successfully!', 'success');
          })
          .catch(error => {
            console.error('Error formatting description:', error);
            // Still show success but log the formatting error
            descriptionInput.value = `From: ${response.from || ''}\nTo: ${response.to || ''}\nDate: ${response.date || ''}\n\n${response.body || ''}`;
            showStatusMessage(ticketStatus, 'Email data extracted (with formatting issues)', 'success');
          });
        
        // Save project key if available
        chrome.storage.sync.get(['projectKey'], function(data) {
          if (data.projectKey) {
            projectKeyInput.value = data.projectKey;
          }
        });
      } else {
        const errorMsg = response.error || 'Unknown error extracting email data';
        console.error('Extraction error:', errorMsg);
        showStatusMessage(ticketStatus, 'Error: ' + errorMsg, 'error');
        
        // Provide troubleshooting help
        const helpText = document.createElement('div');
        helpText.innerHTML = '<p style="margin-top: 10px;"><strong>Troubleshooting tips:</strong></p>' +
                            '<ul style="margin-left: 20px; list-style-type: disc;">' +
                            '<li>Make sure you have an email open (not just the inbox)</li>' +
                            '<li>Try refreshing the page</li>' +
                            '<li>Check if you\'re using the latest version of the extension</li>' +
                            '</ul>';
        
        // Append to the status message
        ticketStatus.appendChild(helpText);
      }
    });
  }

  // Create Jira ticket
  createTicketBtn.addEventListener('click', function() {
    // Save custom fields before creating the ticket
    saveCustomFields();
    createJiraTicket();
  });

  // Open options page
  optionsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Open options page from custom fields link
  document.getElementById('open-options-fields').addEventListener('click', function(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Show field formats guide
  showFieldFormatsBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Check if the guide already exists
    if (document.getElementById('field-formats-guide')) {
      document.getElementById('field-formats-guide').remove();
      return;
    }
    
    const guide = document.createElement('div');
    guide.id = 'field-formats-guide';
    guide.className = 'field-formats-guide';
    
    guide.innerHTML = `
      <h4 style="margin-top: 0;">Field Value Formats:</h4>
      <ul style="padding-left: 20px; margin-bottom: 10px;">
        <li><strong>Text fields:</strong> <span class="field-format-example">"Your text here"</span></li>
        <li><strong>Number fields:</strong> <span class="field-format-example">42</span> (no quotes)</li>
        <li><strong>Date fields:</strong> <span class="field-format-example">"2023-07-30"</span> (ISO format)</li>
        <li><strong>Select/Option fields:</strong> <span class="field-format-example">{"value": "Option value"}</span></li>
        <li><strong>Multi-select fields:</strong> <span class="field-format-example">[{"value": "Option 1"}, {"value": "Option 2"}]</span></li>
        <li><strong>User picker:</strong> <span class="field-format-example">{"name": "username"}</span> or <span class="field-format-example">{"accountId": "user-account-id"}</span></li>
        <li><strong>Checkbox:</strong> <span class="field-format-example">true</span> or <span class="field-format-example">false</span> (no quotes)</li>
      </ul>
      <p style="margin-bottom: 0;"><strong>Tip:</strong> Configure field IDs in the Options page.</p>
    `;
    
    // Insert the guide after the link
    showFieldFormatsBtn.parentElement.after(guide);
  });

  // Function to save custom fields
  function saveCustomFields() {
    const customFields = [];
    const rows = customFieldsContainer.querySelectorAll('.custom-field-row');
    
    rows.forEach(row => {
      const idInput = row.querySelector('.custom-field-id');
      const valueInput = row.querySelector('.custom-field-value');
      const nameLabel = row.querySelector('.field-name-label');
      
      if (idInput && idInput.value) {
        customFields.push({
          id: idInput.value,
          value: valueInput ? valueInput.value : '',
          name: nameLabel ? nameLabel.textContent : '',
          readonly: true // All fields in popup are readonly for ID
        });
      }
    });
    
    chrome.storage.sync.set({ 'customFields': customFields }, function() {
      console.log('Custom fields saved');
    });
  }
  
  // Function to restore custom fields
  function restoreCustomFields() {
    chrome.storage.sync.get(['customFields', 'customFieldsArray'], function(data) {
      // Prioritize customFieldsArray (from options page) if it exists
      const fieldsToUse = data.customFieldsArray && data.customFieldsArray.length > 0 
                           ? data.customFieldsArray 
                           : (data.customFields && data.customFields.length > 0 ? data.customFields : []);
      
      if (fieldsToUse.length > 0) {
        // Clear existing fields
        customFieldsContainer.innerHTML = '';
        
        // Add saved fields to container
        fieldsToUse.forEach(field => {
          createCustomFieldRow(field, customFieldsContainer);
        });
      }
    });
  }
  
  // Helper function to create a custom field row
  function createCustomFieldRow(field, container) {
    const newRow = document.createElement('div');
    newRow.className = 'custom-field-row';
    
    // Add field name label if available
    if (field.name) {
      const fieldLabel = document.createElement('div');
      fieldLabel.className = 'field-name-label';
      fieldLabel.textContent = field.name;
      newRow.appendChild(fieldLabel);
    }
    
    // Field inputs container
    const fieldInputs = document.createElement('div');
    fieldInputs.className = 'field-inputs';
    
    const fieldIdInput = document.createElement('input');
    fieldIdInput.type = 'text';
    fieldIdInput.className = 'custom-field-id';
    fieldIdInput.value = field.id;
    fieldIdInput.readOnly = true;
    fieldIdInput.title = field.name || field.id;
    fieldInputs.appendChild(fieldIdInput);
    
    const fieldValueInput = document.createElement('input');
    fieldValueInput.type = 'text';
    fieldValueInput.className = 'custom-field-value';
    fieldValueInput.value = field.value;
    fieldValueInput.placeholder = 'Field Value';
    fieldInputs.appendChild(fieldValueInput);
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-field';
    removeButton.textContent = '✕';
    removeButton.style.visibility = 'hidden'; // Hide remove button in popup
    fieldInputs.appendChild(removeButton);
    
    newRow.appendChild(fieldInputs);
    container.appendChild(newRow);
    
    // Add change listener for field value
    fieldValueInput.addEventListener('change', saveCustomFields);
  }

  // Helper functions
  function loadSavedData() {
    // Load custom fields
    restoreCustomFields();
    
    // Load project key if available - check multiple possible keys
    chrome.storage.sync.get(['projectKey', 'jiraProjectKey', 'defaultProjectKey', 'defaultProject'], function(data) {
      // Try different possible storage keys, in order of preference
      if (data.projectKey) {
        projectKeyInput.value = data.projectKey;
      } else if (data.defaultProject) {
        projectKeyInput.value = data.defaultProject;
        // Also save as projectKey for future consistency
        chrome.storage.sync.set({ projectKey: data.defaultProject });
      } else if (data.jiraProjectKey) {
        projectKeyInput.value = data.jiraProjectKey;
        // Also save as projectKey for future consistency
        chrome.storage.sync.set({ projectKey: data.jiraProjectKey });
      } else if (data.defaultProjectKey) {
        projectKeyInput.value = data.defaultProjectKey;
        // Also save as projectKey for future consistency
        chrome.storage.sync.set({ projectKey: data.defaultProjectKey });
      }
      
      console.log('Project key loaded:', projectKeyInput.value);
    });
  }

  function createJiraTicket() {
    // Get Jira credentials
    chrome.storage.sync.get(['jiraUrl', 'apiToken', 'email'], function(data) {
      if (!data.jiraUrl || !data.apiToken || !data.email) {
        showStatusMessage(ticketStatus, 'Jira credentials not set. Please go to the Options page to configure them.', 'error');
        return;
      }
      
      // Store jiraUrl in a variable accessible throughout this function
      const jiraUrl = data.jiraUrl;
      const projectKey = projectKeyInput.value.trim();
      const issueType = issueTypeSelect.value;
      const summary = summaryInput.value.trim();
      const description = descriptionInput.value.trim();

      if (!projectKey || !summary) {
        showStatusMessage(ticketStatus, 'Project key and summary are required.', 'error');
        return;
      }

      // Save project key for next use
      chrome.storage.sync.set({ projectKey: projectKey });

      // Create the ticket
      const url = `${data.jiraUrl}/rest/api/2/issue/`;
      const auth = btoa(`${data.email}:${data.apiToken}`);

      // Prepare payload with standard fields
      const payload = {
        fields: {
          project: {
            key: projectKey
          },
          summary: summary,
          description: description,
          issuetype: {
            name: issueType
          }
        }
      };
      
      // Add custom fields to payload
      const customFieldRows = document.querySelectorAll('.custom-field-row');
      customFieldRows.forEach(row => {
        const fieldId = row.querySelector('.custom-field-id').value.trim();
        const fieldValue = row.querySelector('.custom-field-value').value.trim();
        
        if (fieldId && fieldValue) {
          try {
            // Try to parse as JSON first for complex values
            try {
              payload.fields[fieldId] = JSON.parse(fieldValue);
            } catch (e) {
              // If not valid JSON, use as string
              payload.fields[fieldId] = fieldValue;
            }
          } catch (e) {
            console.error('Error adding custom field:', e);
          }
        }
      });

      showStatusMessage(ticketStatus, 'Creating ticket...', '');
      createTicketBtn.disabled = true;

      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.errorMessages ? errorData.errorMessages.join(', ') : 'Failed to create ticket');
          });
        }
        return response.json();
      })
      .then(data => {
        const ticketUrl = `${jiraUrl}/browse/${data.key}`;
        showStatusMessage(ticketStatus, `Ticket created successfully! <a href="${ticketUrl}" target="_blank">${data.key}</a>`, 'success');
        
        // Clear form fields
        summaryInput.value = '';
        descriptionInput.value = '';
      })
      .catch(error => {
        showStatusMessage(ticketStatus, `Error: ${error.message}`, 'error');
      })
      .finally(() => {
        createTicketBtn.disabled = false;
      });
    });
  }

  function formatEmailToDescription(emailData) {
    // Get template from storage or use default
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        emailTemplate: 'From: {from}\nTo: {to}\nDate: {date}\n\n----- Email Content -----\n\n{body}'
      }, function(items) {
        let template = items.emailTemplate;
        
        // Replace variables in template
        let description = template
          .replace('{from}', emailData.from || '')
          .replace('{to}', emailData.to || '')
          .replace('{date}', emailData.date || '')
          .replace('{body}', emailData.body || '');
        
        resolve(description);
      });
    }).catch(() => {
      // Fallback to basic format if template fails
      let description = '';
      
      if (emailData.from) {
        description += `From: ${emailData.from}\n`;
      }
      
      if (emailData.to) {
        description += `To: ${emailData.to}\n`;
      }
      
      if (emailData.date) {
        description += `Date: ${emailData.date}\n`;
      }
      
      description += '\n----- Email Content -----\n\n';
      
      if (emailData.body) {
        description += emailData.body;
      }
      
      return description;
    });
  }

  function showStatusMessage(element, message, type) {
    element.innerHTML = message;
    element.className = type || '';
    
    if (type === 'success' || type === 'error') {
      // Clear message after 5 seconds unless it's for a created ticket or connection error
      if (!message.includes('Ticket created successfully') && !message.includes('Cannot connect to email page')) {
        setTimeout(() => {
          element.innerHTML = '';
          element.className = '';
        }, 5000);
      }
    }
  }

  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
  
  // Test connection to Jira API
  function testJiraConnection(jiraUrl, email, apiToken) {
    // Ensure the URL doesn't end with a slash
    if (jiraUrl.endsWith('/')) {
      jiraUrl = jiraUrl.slice(0, -1);
    }
    
    // Fetch user information as a simple connectivity test
    const apiEndpoint = `${jiraUrl}/rest/api/3/myself`;
    
    return fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${email}:${apiToken}`),
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Check your email and API token.');
        } else if (response.status === 403) {
          throw new Error('Permission denied. Your account may not have appropriate access.');
        } else if (response.status === 404) {
          throw new Error('API endpoint not found. Check your Jira URL.');
        } else {
          throw new Error(`HTTP error ${response.status}`);
        }
      }
      return response.json();
    })
    .catch(error => {
      // Handle network errors or other exceptions
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Could not connect to Jira. Check your URL and network connection.');
      }
      throw error;
    });
  }
}); 