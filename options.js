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
  
  // Field Explorer elements
  const exploreFieldsBtn = document.getElementById('explore-fields');
  const fieldsSearchResults = document.getElementById('fields-search-results');
  const defaultCustomFieldsContainer = document.getElementById('default-custom-fields-container');
  const addCustomFieldBtn = document.getElementById('add-custom-field');

  // Load saved settings
  loadSettings();

  // Event listeners
  testConnectionBtn.addEventListener('click', testConnection);
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
  
  // Field Explorer events
  exploreFieldsBtn.addEventListener('click', exploreJiraFields);
  addCustomFieldBtn.addEventListener('click', addCustomFieldRow);
  
  // Setup initial custom field listeners
  setupCustomFieldListeners();

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
      customFieldsJson: '{}',
      includeAttachments: false,
      // Load custom fields array
      customFieldsArray: []
    }, function(items) {
      jiraUrlInput.value = items.jiraUrl;
      apiTokenInput.value = items.apiToken;
      emailInput.value = items.email;
      defaultProjectInput.value = items.defaultProject;
      defaultIssueTypeSelect.value = items.defaultIssueType;
      emailTemplateInput.value = items.emailTemplate;
      
      // Prefer customFieldsJson as it's formatted for the textarea
      customFieldsInput.value = items.customFieldsJson || items.customFields;
      
      includeAttachmentsCheckbox.checked = items.includeAttachments;
      
      // Restore custom fields - use customFieldsArray if available
      restoreCustomFields(items.customFieldsArray);
    });
  }

  // Save settings to storage
  function saveSettings() {
    // Validate custom fields JSON
    let customFieldsJsonObj = {};
    try {
      if (customFieldsInput.value.trim()) {
        customFieldsJsonObj = JSON.parse(customFieldsInput.value);
      }
    } catch (e) {
      alert('Invalid JSON in Custom Fields. Please check the format.');
      return;
    }
    
    // Save custom fields from the field explorer
    saveCustomFields();

    // Save all settings
    chrome.storage.sync.set({
      jiraUrl: jiraUrlInput.value.trim(),
      apiToken: apiTokenInput.value.trim(),
      email: emailInput.value.trim(),
      defaultProject: defaultProjectInput.value.trim(),
      defaultIssueType: defaultIssueTypeSelect.value,
      emailTemplate: emailTemplateInput.value,
      customFieldsJson: customFieldsInput.value,
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
        customFieldsJson: '{}',
        customFieldsArray: [], // Reset custom fields array
        includeAttachments: false
      }, function() {
        // Reload settings
        loadSettings();
        
        // Reset custom fields container
        defaultCustomFieldsContainer.innerHTML = '';
        
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
  
  // Explore Jira Fields
  function exploreJiraFields() {
    const jiraUrl = jiraUrlInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    const email = emailInput.value.trim();

    if (!jiraUrl || !apiToken || !email) {
      showConnectionStatus('Please fill in all Jira connection fields.', 'error');
      return;
    }

    // Show loading state
    showConnectionStatus('Fetching Jira fields...', '');
    exploreFieldsBtn.disabled = true;
    
    // Ensure URL has protocol and no trailing slash
    let validatedUrl = jiraUrl;
    if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
      validatedUrl = 'https://' + validatedUrl;
    }
    if (validatedUrl.endsWith('/')) {
      validatedUrl = validatedUrl.slice(0, -1);
    }
    
    fetchJiraFields(validatedUrl, email, apiToken)
      .then(fields => {
        // Display fields
        fieldsSearchResults.style.display = 'block';
        fieldsSearchResults.innerHTML = ''; // Clear previous results
        
        // Add search box
        const searchBox = document.createElement('input');
        searchBox.type = 'text';
        searchBox.placeholder = 'Search fields...';
        searchBox.style.width = '100%';
        searchBox.style.marginBottom = '10px';
        fieldsSearchResults.appendChild(searchBox);
        
        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'fields-container';
        fieldsSearchResults.appendChild(fieldsContainer);
        
        // Display fields
        displayFields(fields, fieldsContainer);
        
        // Add search functionality
        searchBox.addEventListener('input', function() {
          const searchTerm = this.value.toLowerCase();
          const filteredFields = fields.filter(field => 
            field.id.toLowerCase().includes(searchTerm) || 
            field.name.toLowerCase().includes(searchTerm) ||
            (field.schema && field.schema.type && field.schema.type.toLowerCase().includes(searchTerm))
          );
          displayFields(filteredFields, fieldsContainer);
        });
        
        // Show success message
        showConnectionStatus(`Found ${fields.length} fields in your Jira instance.`, 'success');
      })
      .catch(error => {
        console.error('Error fetching Jira fields:', error);
        showConnectionStatus(`Error: ${error.message}`, 'error');
      })
      .finally(() => {
        exploreFieldsBtn.disabled = false;
      });
  }
  
  // Fetch Jira fields
  function fetchJiraFields(jiraUrl, email, apiToken) {
    return fetch(`${jiraUrl}/rest/api/3/field`, {
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
        } else {
          throw new Error(`HTTP error ${response.status}`);
        }
      }
      return response.json();
    });
  }
  
  // Display fields in the container
  function displayFields(fields, container) {
    container.innerHTML = '';
    
    if (fields.length === 0) {
      container.innerHTML = '<p>No fields match your search criteria.</p>';
      return;
    }
    
    // Sort fields alphabetically by name
    fields.sort((a, b) => a.name.localeCompare(b.name));
    
    // Group fields by custom vs standard
    const customFields = fields.filter(field => field.custom);
    const standardFields = fields.filter(field => !field.custom);
    
    // Display custom fields first (most likely what users want)
    if (customFields.length > 0) {
      const customHeader = document.createElement('h3');
      customHeader.textContent = 'Custom Fields';
      customHeader.style.fontSize = '14px';
      customHeader.style.margin = '10px 0 5px 0';
      container.appendChild(customHeader);
      
      customFields.forEach(field => addFieldToContainer(field, container));
    }
    
    if (standardFields.length > 0) {
      const standardHeader = document.createElement('h3');
      standardHeader.textContent = 'Standard Fields';
      standardHeader.style.fontSize = '14px';
      standardHeader.style.margin = '15px 0 5px 0';
      container.appendChild(standardHeader);
      
      standardFields.forEach(field => addFieldToContainer(field, container));
    }
  }
  
  // Add individual field to container
  function addFieldToContainer(field, container) {
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    
    const fieldId = document.createElement('div');
    fieldId.className = 'field-id';
    fieldId.textContent = field.id;
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'field-button-group';
    
    // Copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy ID';
    copyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(field.id).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy ID';
        }, 1500);
      });
    });
    
    // Add to form button
    const addButton = document.createElement('button');
    addButton.className = 'add-button';
    addButton.textContent = 'Add to Form';
    addButton.addEventListener('click', function() {
      const fieldData = {
        id: field.id,
        value: '',
        name: field.name,
        readonly: true
      };
      
      createCustomFieldRow(fieldData);
      saveCustomFields();
      
      // Add success feedback
      addButton.textContent = 'Added!';
      setTimeout(() => {
        addButton.textContent = 'Add to Form';
      }, 1500);
    });
    
    buttonGroup.appendChild(copyButton);
    buttonGroup.appendChild(addButton);
    fieldId.appendChild(buttonGroup);
    fieldItem.appendChild(fieldId);
    
    const fieldName = document.createElement('div');
    fieldName.className = 'field-name';
    fieldName.textContent = field.name;
    fieldItem.appendChild(fieldName);
    
    if (field.schema && field.schema.type) {
      const fieldType = document.createElement('div');
      fieldType.className = 'field-type';
      
      // Get the type information
      let typeText = `Type: ${field.schema.type}`;
      if (field.schema.custom) {
        typeText += ` (${field.schema.custom})`;
      }
      
      // Add value format hint
      typeText += ` • Format: ${getFormatHint(field)}`;
      
      fieldType.textContent = typeText;
      fieldItem.appendChild(fieldType);
    }
    
    container.appendChild(fieldItem);
  }
  
  // Get format hint based on field type
  function getFormatHint(field) {
    if (!field.schema) return 'text';
    
    const type = field.schema.type;
    
    if (type === 'string') {
      return 'text';
    } else if (type === 'number') {
      return 'number (no quotes)';
    } else if (type === 'date' || type === 'datetime') {
      return 'YYYY-MM-DD';
    } else if (type === 'option') {
      return 'JSON object';
    } else if (type === 'array') {
      return 'JSON array';
    } else if (type === 'user') {
      return 'JSON object';
    } else if (type === 'boolean') {
      return 'true/false';
    } else {
      return 'text';
    }
  }
  
  // Add new custom field row
  function addCustomFieldRow() {
    const fieldData = {
      id: '',
      value: '',
      name: '',
      readonly: false
    };
    
    createCustomFieldRow(fieldData);
    saveCustomFields();
  }
  
  // Create custom field row
  function createCustomFieldRow(field) {
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
    if (field.readonly) {
      fieldIdInput.readOnly = true;
      fieldIdInput.title = field.name;
    } else {
      fieldIdInput.placeholder = 'Field ID (e.g., customfield_10001)';
    }
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
    removeButton.addEventListener('click', function() {
      newRow.remove();
      saveCustomFields();
    });
    fieldInputs.appendChild(removeButton);
    
    newRow.appendChild(fieldInputs);
    defaultCustomFieldsContainer.appendChild(newRow);
    
    // Add change listeners for inputs
    fieldIdInput.addEventListener('change', saveCustomFields);
    fieldIdInput.addEventListener('blur', saveCustomFields);
    fieldValueInput.addEventListener('change', saveCustomFields);
    fieldValueInput.addEventListener('blur', saveCustomFields);
  }
  
  // Save custom fields
  function saveCustomFields() {
    const customFields = [];
    
    document.querySelectorAll('#default-custom-fields-container .custom-field-row').forEach(row => {
      const fieldId = row.querySelector('.custom-field-id');
      const fieldValue = row.querySelector('.custom-field-value');
      
      if (fieldId && fieldValue && fieldId.value.trim()) {
        // Get the field name label if it exists
        const fieldNameLabel = row.querySelector('.field-name-label');
        const fieldName = fieldNameLabel ? fieldNameLabel.textContent : '';
        
        customFields.push({
          id: fieldId.value.trim(),
          value: fieldValue.value.trim(),
          name: fieldName,
          readonly: fieldId.readOnly
        });
      }
    });
    
    // Save to both storage keys for compatibility with popup
    chrome.storage.sync.set({ 
      customFieldsArray: customFields,
      customFields: customFields
    }, function() {
      console.log('Custom fields saved:', customFields);
      
      // Also update the JSON textarea
      const customFieldsJson = {};
      customFields.forEach(field => {
        try {
          // Try to parse as JSON first for complex values
          try {
            customFieldsJson[field.id] = JSON.parse(field.value);
          } catch (e) {
            // If not valid JSON, use as string
            customFieldsJson[field.id] = field.value;
          }
        } catch (e) {
          console.error('Error adding custom field to JSON:', e);
        }
      });
      
      const jsonString = JSON.stringify(customFieldsJson, null, 2);
      customFieldsInput.value = jsonString;
      
      // Save the formatted JSON as well
      chrome.storage.sync.set({ customFieldsJson: jsonString });
    });
  }
  
  // Restore custom fields
  function restoreCustomFields(customFieldsArray) {
    if (customFieldsArray && customFieldsArray.length > 0) {
      // Clear existing fields
      defaultCustomFieldsContainer.innerHTML = '';
      
      // Add saved fields
      customFieldsArray.forEach(field => {
        createCustomFieldRow(field);
      });
    }
  }
  
  // Setup listeners for custom field changes
  function setupCustomFieldListeners() {
    // Using event delegation to handle dynamically added fields
    defaultCustomFieldsContainer.addEventListener('change', function(e) {
      if (e.target.classList.contains('custom-field-id') || 
          e.target.classList.contains('custom-field-value')) {
        saveCustomFields();
      }
    });
    
    defaultCustomFieldsContainer.addEventListener('blur', function(e) {
      if (e.target.classList.contains('custom-field-id') || 
          e.target.classList.contains('custom-field-value')) {
        saveCustomFields();
      }
    }, true);
  }
}); 