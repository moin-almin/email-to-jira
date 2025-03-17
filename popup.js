document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const jiraUrlInput = document.getElementById('jira-url');
  const apiTokenInput = document.getElementById('api-token');
  const emailInput = document.getElementById('email');
  const saveCredentialsBtn = document.getElementById('save-credentials');
  const testConnectionBtn = document.getElementById('test-connection');
  const statusMessage = document.getElementById('status-message');
  const projectKeyInput = document.getElementById('project-key');
  const issueTypeSelect = document.getElementById('issue-type');
  const summaryInput = document.getElementById('summary');
  const descriptionInput = document.getElementById('description');
  const createTicketBtn = document.getElementById('create-ticket');
  const extractFromEmailBtn = document.getElementById('extract-from-email');
  const ticketStatus = document.getElementById('ticket-status');
  const optionsBtn = document.getElementById('options-btn');
  const toggleViewBtn = document.getElementById('toggle-view');
  const loginSection = document.getElementById('login-section');
  const createTicketSection = document.getElementById('create-ticket-section');

  // Load saved credentials and preferences
  loadSavedData();

  // Save credentials
  saveCredentialsBtn.addEventListener('click', function() {
    const jiraUrl = jiraUrlInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    const email = emailInput.value.trim();

    if (!jiraUrl || !apiToken || !email) {
      showStatusMessage(statusMessage, 'Please fill in all fields.', 'error');
      return;
    }

    // Validate URL format
    if (!isValidUrl(jiraUrl)) {
      showStatusMessage(statusMessage, 'Please enter a valid Jira URL.', 'error');
      return;
    }

    // Save to chrome.storage
    chrome.storage.sync.set({
      jiraUrl: jiraUrl,
      apiToken: apiToken,
      email: email
    }, function() {
      showStatusMessage(statusMessage, 'Credentials saved successfully!', 'success');
      // Switch to create ticket view
      loginSection.style.display = 'none';
      createTicketSection.style.display = 'block';
    });
  });

  // Test Jira connection
  testConnectionBtn.addEventListener('click', function() {
    const jiraUrl = jiraUrlInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    const email = emailInput.value.trim();

    if (!jiraUrl || !apiToken || !email) {
      showStatusMessage(statusMessage, 'Please fill in all fields.', 'error');
      return;
    }

    // Validate URL format
    let validatedUrl = jiraUrl;
    try {
      // Ensure URL has protocol
      if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
        validatedUrl = 'https://' + validatedUrl;
      }
      new URL(validatedUrl);
    } catch (e) {
      showStatusMessage(statusMessage, `Error: Invalid Jira URL format`, 'error');
      return;
    }

    // Show testing status
    showStatusMessage(statusMessage, 'Testing connection...', '');
    testConnectionBtn.disabled = true;
    
    testJiraConnection(validatedUrl, email, apiToken)
      .then(result => {
        const userName = result.displayName ? ` as ${result.displayName}` : '';
        showStatusMessage(statusMessage, `Connection successful${userName}!`, 'success');
      })
      .catch(error => {
        console.error('Connection test error:', error);
        
        let errorMessage = `Connection failed: ${error.message}`;
        let troubleshootingTips = '';
        
        if (error.message.includes('Authentication failed') || error.message.includes('401')) {
          troubleshootingTips = `
            <div class="help-text" style="margin-top: 10px;">
              <p>• Check your email address and API token</p>
              <p>• Make sure you're using an API token, not your Jira password</p>
              <p>• <a href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/" target="_blank">Generate a new API token</a></p>
            </div>
          `;
        } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
          troubleshootingTips = `
            <div class="help-text" style="margin-top: 10px;">
              <p>• Check your Jira URL format (should be https://your-domain.atlassian.net)</p>
              <p>• Verify your internet connection</p>
              <p>• Your Jira instance might not allow API access from browser extensions</p>
            </div>
          `;
        }
        
        showStatusMessage(statusMessage, errorMessage, 'error');
        if (troubleshootingTips) {
          const helpText = document.createElement('div');
          helpText.innerHTML = troubleshootingTips;
          statusMessage.appendChild(helpText);
        }
      })
      .finally(() => {
        testConnectionBtn.disabled = false;
      });
  });

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
    createJiraTicket();
  });

  // Toggle between login and create ticket views
  toggleViewBtn.addEventListener('click', function() {
    if (loginSection.style.display === 'none') {
      loginSection.style.display = 'block';
      createTicketSection.style.display = 'none';
      toggleViewBtn.textContent = 'Create Ticket';
    } else {
      loginSection.style.display = 'none';
      createTicketSection.style.display = 'block';
      toggleViewBtn.textContent = 'Settings';
    }
  });

  // Open options page
  optionsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Helper functions
  function loadSavedData() {
    chrome.storage.sync.get(['jiraUrl', 'apiToken', 'email', 'projectKey'], function(data) {
      if (data.jiraUrl) jiraUrlInput.value = data.jiraUrl;
      if (data.apiToken) apiTokenInput.value = data.apiToken;
      if (data.email) emailInput.value = data.email;
      if (data.projectKey) projectKeyInput.value = data.projectKey;

      // If credentials are already set, show create ticket view by default
      if (data.jiraUrl && data.apiToken && data.email) {
        loginSection.style.display = 'none';
        createTicketSection.style.display = 'block';
        toggleViewBtn.textContent = 'Settings';
      }
    });
  }

  function createJiraTicket() {
    // Get Jira credentials
    chrome.storage.sync.get(['jiraUrl', 'apiToken', 'email'], function(data) {
      if (!data.jiraUrl || !data.apiToken || !data.email) {
        showStatusMessage(ticketStatus, 'Jira credentials not set. Please go to settings.', 'error');
        return;
      }

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
        const ticketUrl = `${jiraUrlInput.value}/browse/${data.key}`;
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