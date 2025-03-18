document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const projectKeyInput = document.getElementById('project-key');
  const issueTypeSelect = document.getElementById('issue-type');
  const summaryInput = document.getElementById('summary');
  const descriptionInput = document.getElementById('description');
  const extractFromEmailBtn = document.getElementById('extract-from-email');
  const createTicketBtn = document.getElementById('create-ticket');
  const ticketStatus = document.getElementById('ticket-status');
  const customFieldsContainer = document.getElementById('custom-fields-container');
  const optionsBtn = document.getElementById('options-btn');

  // Load saved data
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
      
      // Handle error responses
      if (!response.success) {
        console.error('Error response from content script:', response.error);
        showStatusMessage(ticketStatus, 'Error: ' + response.error, 'error');
        return;
      }
      
      // Handle successful responses
      console.log('Successfully extracted email data:', response);
      
      // Fill the form with email data
      if (response.subject) {
        summaryInput.value = response.subject;
      }
      
      // Format description using template from options
      chrome.storage.sync.get('emailTemplate', function(data) {
        let template = 'From: {from}\nTo: {to}\nDate: {date}\n\n----- Email Content -----\n\n{body}';
        
        // Use saved template if available
        if (data.emailTemplate) {
          template = data.emailTemplate;
        }
        
        // Replace template variables with actual data
        let description = template
          .replace('{from}', response.from || 'N/A')
          .replace('{to}', response.to || 'N/A')
          .replace('{date}', response.date || 'N/A')
          .replace('{body}', response.body || 'No content extracted');
          
        descriptionInput.value = description;
      });
      
      showStatusMessage(ticketStatus, 'Email data extracted successfully!', 'success');
    });
  }

  // Event listener for create ticket button
  createTicketBtn.addEventListener('click', createJiraTicket);

  // Open options page
  optionsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

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
          // Try to convert value to appropriate type
          let parsedValue = fieldValue;
          
          try {
            // If value is a number, convert to number
            if (!isNaN(fieldValue) && !isNaN(parseFloat(fieldValue))) {
              parsedValue = parseFloat(fieldValue);
            }
            // If value is JSON, parse it
            else if ((fieldValue.startsWith('{') && fieldValue.endsWith('}')) || 
                   (fieldValue.startsWith('[') && fieldValue.endsWith(']'))) {
              parsedValue = JSON.parse(fieldValue);
            }
          } catch (e) {
            console.warn('Failed to parse value for field', fieldId, e);
          }
          
          payload.fields[fieldId] = parsedValue;
        }
      });
      
      // Show loading status
      showStatusMessage(ticketStatus, 'Creating Jira ticket...', '');
      createTicketBtn.disabled = true;
      
      // Make API request to create Jira ticket
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
            throw new Error(
              `${response.status} ${response.statusText}: ${
                errorData.errorMessages ? 
                errorData.errorMessages.join(', ') : 
                JSON.stringify(errorData.errors || errorData)
              }`
            );
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('Ticket created successfully:', data);
        const ticketKey = data.key;
        const ticketUrl = `${jiraUrl}/browse/${ticketKey}`;
        
        // Create success message with link to ticket
        const successMessage = document.createElement('div');
        successMessage.innerHTML = `
          <div>Ticket created successfully!</div>
          <div style="margin-top: 8px;">
            <a href="${ticketUrl}" target="_blank" style="color: #0052cc; text-decoration: underline;">
              ${ticketKey} - Open in Jira
            </a>
          </div>
        `;
        
        showStatusMessage(ticketStatus, successMessage, 'success');
        
        // Optionally clear the form or parts of it
        summaryInput.value = '';
        descriptionInput.value = '';
        customFieldRows.forEach(row => {
          row.querySelector('.custom-field-value').value = '';
        });
      })
      .catch(error => {
        console.error('Error creating Jira ticket:', error);
        
        let errorMessage = error.message || 'Failed to create ticket. Please check your Jira connection.';
        
        // Provide better error messages for common issues
        if (errorMessage.includes('401')) {
          errorMessage = 'Authentication failed. Please check your Jira credentials in the Options page.';
        } else if (errorMessage.includes('403')) {
          errorMessage = 'Permission denied. Your account may not have permission to create tickets in this project.';
        } else if (errorMessage.includes('404')) {
          errorMessage = 'Project not found. Check if the project key is correct.';
        } else if (errorMessage.includes('400') && errorMessage.includes('customfield')) {
          errorMessage = 'Invalid custom field value. Please check the format of your custom fields.';
        }
        
        showStatusMessage(ticketStatus, errorMessage, 'error');
      })
      .finally(() => {
        createTicketBtn.disabled = false;
      });
    });
  }

  // Load saved project key and restore custom fields
  function loadSavedData() {
    // Load project key
    chrome.storage.sync.get(['projectKey', 'defaultProject'], function(data) {
      if (data.projectKey) {
        projectKeyInput.value = data.projectKey;
      } else if (data.defaultProject) {
        projectKeyInput.value = data.defaultProject;
      }
    });
    
    // Load custom fields
    restoreCustomFields();
  }

  // Restore custom fields
  function restoreCustomFields() {
    chrome.storage.sync.get('customFieldsArray', function(data) {
      customFieldsContainer.innerHTML = '';
      
      if (data.customFieldsArray && data.customFieldsArray.length > 0) {
        data.customFieldsArray.forEach(field => {
          createCustomFieldRow(field);
        });
      }
    });
  }

  // Create custom field row
  function createCustomFieldRow(field) {
    const newRow = document.createElement('div');
    newRow.className = 'custom-field-row';
    
    if (field.name) {
      const fieldLabel = document.createElement('div');
      fieldLabel.className = 'field-name-label';
      fieldLabel.textContent = field.name;
      newRow.appendChild(fieldLabel);
    }
    
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
    fieldValueInput.value = field.value || '';
    fieldValueInput.placeholder = 'Field Value';
    fieldInputs.appendChild(fieldValueInput);
    
    newRow.appendChild(fieldInputs);
    customFieldsContainer.appendChild(newRow);
  }

  // Show status message
  function showStatusMessage(container, message, type) {
    // Clear previous messages
    container.innerHTML = '';
    container.className = type || '';
    
    if (typeof message === 'string') {
      container.textContent = message;
    } else {
      container.appendChild(message);
    }
  }
}); 