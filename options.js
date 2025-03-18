document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const jiraUrlInput = document.getElementById('jira-url');
  const apiTokenInput = document.getElementById('api-token');
  const emailInput = document.getElementById('email');
  const defaultProjectInput = document.getElementById('default-project');
  const defaultIssueTypeInput = document.getElementById('default-issue-type');
  const emailTemplateInput = document.getElementById('email-template');
  const customFieldsInput = document.getElementById('custom-fields');
  const includeAttachmentsInput = document.getElementById('include-attachments');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const testConnectionBtn = document.getElementById('test-connection');
  const connectionStatus = document.getElementById('connection-status');
  const exploreFieldsBtn = document.getElementById('explore-fields');
  const fieldsSearchResults = document.getElementById('fields-search-results');
  const defaultCustomFieldsContainer = document.getElementById('default-custom-fields-container');
  
  // Load saved settings
  loadSettings();

  // Event listeners
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
  testConnectionBtn.addEventListener('click', testConnection);
  exploreFieldsBtn.addEventListener('click', exploreJiraFields);
  
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
      defaultIssueTypeInput.value = items.defaultIssueType;
      emailTemplateInput.value = items.emailTemplate;
      
      // Prefer customFieldsJson as it's formatted for the textarea
      customFieldsInput.value = items.customFieldsJson || items.customFields;
      
      includeAttachmentsInput.checked = items.includeAttachments;
      
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
      defaultIssueType: defaultIssueTypeInput.value,
      emailTemplate: emailTemplateInput.value,
      customFieldsJson: customFieldsInput.value,
      includeAttachments: includeAttachmentsInput.checked
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
    
    // Check if we have recent cached data (less than 1 hour old)
    const cacheKey = `fieldCache_${validatedUrl}_${email}`;
    const now = Date.now();
    
    chrome.storage.local.get([cacheKey, `${cacheKey}_timestamp`], function(data) {
      const cachedFields = data[cacheKey];
      const cacheTimestamp = data[`${cacheKey}_timestamp`] || 0;
      const cacheAge = now - cacheTimestamp;
      const cacheValid = cacheAge < 60 * 60 * 1000; // 1 hour in milliseconds
      
      if (cachedFields && cacheValid) {
        // Use cached data
        console.log('Using cached field data from', new Date(cacheTimestamp));
        showConnectionStatus('Loading fields from cache...', 'success');
        displayFieldsFromData(cachedFields);
      } else {
        // No valid cache, fetch fresh data
        fetchJiraFields(validatedUrl, email, apiToken)
          .then(fields => {
            // Cache the result for 1 hour
            const cacheData = {};
            cacheData[cacheKey] = fields;
            cacheData[`${cacheKey}_timestamp`] = now;
            chrome.storage.local.set(cacheData);
            
            displayFieldsFromData(fields);
          })
          .catch(error => {
            console.error('Error fetching Jira fields:', error);
            showConnectionStatus(`Error: ${error.message}`, 'error');
            exploreFieldsBtn.disabled = false;
          });
      }
    });
    
    // Helper to display fields from either cache or fresh API call
    function displayFieldsFromData(fields) {
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
      
      // Add refresh button (to force reload)
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'secondary-btn';
      refreshBtn.textContent = 'Refresh Fields';
      refreshBtn.style.marginTop = '10px';
      refreshBtn.style.fontSize = '12px';
      refreshBtn.addEventListener('click', function() {
        // Clear cache for this URL/email combo
        chrome.storage.local.remove([cacheKey, `${cacheKey}_timestamp`]);
        // Reload
        exploreJiraFields();
      });
      fieldsSearchResults.appendChild(refreshBtn);
      
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
      exploreFieldsBtn.disabled = false;
    }
  }
  
  // Fetch Jira fields (optimized version)
  function fetchJiraFields(jiraUrl, email, apiToken) {
    // Show loading state with progress indicator
    const progressDiv = document.createElement('div');
    progressDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="loading-spinner"></div>
        <p id="fetch-status" style="margin-top: 10px; font-size: 12px;">Fetching field metadata...</p>
      </div>
    `;
    fieldsSearchResults.style.display = 'block';
    fieldsSearchResults.innerHTML = '';
    fieldsSearchResults.appendChild(progressDiv);
    
    const updateStatus = (message) => {
      const statusEl = document.getElementById('fetch-status');
      if (statusEl) statusEl.textContent = message;
    };
    
    // Use Promise.all to fetch field metadata and project metadata concurrently
    const basicAuth = 'Basic ' + btoa(`${email}:${apiToken}`);
    
    // Step 1: First fetch basic field metadata
    return fetch(`${jiraUrl}/rest/api/3/field`, {
      method: 'GET',
      headers: {
        'Authorization': basicAuth,
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
    })
    .then(fields => {
      // Step 2: Get project key if available
      updateStatus('Fetching metadata for fields...');
      return chrome.storage.sync.get(['defaultProject']).then(data => {
        const projectKey = data.defaultProject || '';
        let metadataUrl = `${jiraUrl}/rest/api/3/issue/createmeta`;
        
        if (projectKey) {
          metadataUrl += `?projectKeys=${projectKey}&expand=projects.issuetypes.fields`;
        } else {
          // Limit results for faster loading if no specific project
          metadataUrl += `?expand=projects.issuetypes.fields&maxResults=1`;  
        }
        
        // Fetch issue metadata
        return fetch(metadataUrl, {
          method: 'GET',
          headers: {
            'Authorization': basicAuth,
            'Accept': 'application/json'
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status} when fetching issue metadata`);
          }
          return response.json();
        })
        .then(metaData => {
          updateStatus('Processing field data...');
          // Enhanced fields with allowedValues from metadata
          return fields.map(field => {
            const enhancedField = { ...field };
            
            // Try to find this field in the metadata to get allowed values
            if (metaData.projects && metaData.projects.length > 0) {
              // Only process first project for speed
              const project = metaData.projects[0];
              if (project.issuetypes && project.issuetypes.length > 0) {
                // Only process first issue type for speed
                const issueType = project.issuetypes[0]; 
                if (issueType.fields && issueType.fields[field.id]) {
                  const fieldMeta = issueType.fields[field.id];
                  
                  // Get allowed values if available
                  if (fieldMeta.allowedValues && fieldMeta.allowedValues.length > 0) {
                    enhancedField.allowedValues = fieldMeta.allowedValues;
                  }
                  
                  // Get default value if available
                  if (fieldMeta.defaultValue) {
                    enhancedField.defaultValue = fieldMeta.defaultValue;
                  }
                  
                  // Get other useful metadata
                  if (fieldMeta.required !== undefined) {
                    enhancedField.required = fieldMeta.required;
                  }
                }
              }
            }
            return enhancedField;
          });
        });
      });
    });
  }
  
  // Display fields in the container
  function displayFields(fields, container) {
    // Clear the container first
    container.innerHTML = '';
    
    // Sort fields into custom and standard
    const customFields = fields.filter(field => field.custom);
    const standardFields = fields.filter(field => !field.custom);
    
    // Get current custom fields to check which ones are already added
    chrome.storage.sync.get(['customFieldsArray', 'customFieldsJson'], function(data) {
      const currentFields = data.customFieldsArray || [];
      const currentFieldIds = currentFields.map(f => f.id);
      const customFieldsJsonObj = data.customFieldsJson ? JSON.parse(data.customFieldsJson) : {};

      // Display custom fields first
      if (customFields.length > 0) {
        const customTitle = document.createElement('h3');
        customTitle.textContent = 'Custom Fields';
        container.appendChild(customTitle);
        
        customFields.forEach(field => {
          const fieldDiv = createFieldItem(field, currentFieldIds, customFieldsJsonObj);
          container.appendChild(fieldDiv);
        });
      }
      
      // Display standard fields
      if (standardFields.length > 0) {
        const standardTitle = document.createElement('h3');
        standardTitle.textContent = 'Standard Fields';
        container.appendChild(standardTitle);
        
        standardFields.forEach(field => {
          const fieldDiv = createFieldItem(field, currentFieldIds, customFieldsJsonObj);
          container.appendChild(fieldDiv);
        });
      }
    });
  }

  // Helper function to create a field item
  function createFieldItem(field, currentFieldIds, customFieldsJsonObj) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `field-${field.id}`;
    checkbox.checked = currentFieldIds.includes(field.id);
    
    // Build field type description
    let typeDescription = field.schema?.type || 'unknown';
    if (field.schema?.custom) {
      typeDescription += ' • Format: ' + field.schema.custom;
    }
    if (field.allowedValues && field.allowedValues.length > 0) {
      typeDescription += ` • Options: ${field.allowedValues.length}`;
    }
    
    const label = document.createElement('label');
    label.htmlFor = `field-${field.id}`;
    label.innerHTML = `<strong>${field.name}</strong> (${field.id})<br>
                     <span class="field-type">Type: ${typeDescription}</span>`;
    
    fieldDiv.appendChild(checkbox);
    fieldDiv.appendChild(label);
    
    // Add change listener to checkbox
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        // Add field to custom fields
        addFieldToCustomFields(field);
      } else {
        // Remove field from custom fields
        removeFieldFromCustomFields(field.id);
      }
      
      // Update the custom fields JSON textarea
      updateCustomFieldsJson();
    });
    
    return fieldDiv;
  }

  // Helper function to update custom fields JSON
  function updateCustomFieldsJson() {
    const customFields = [];
    document.querySelectorAll('#default-custom-fields-container .custom-field-row').forEach(row => {
      const fieldId = row.querySelector('.custom-field-id');
      const fieldValue = row.querySelector('.custom-field-value');
      
      if (fieldId && fieldValue && fieldId.value.trim()) {
        // Get the field name label if it exists
        const fieldNameLabel = row.querySelector('.field-name-label');
        const fieldName = fieldNameLabel ? fieldNameLabel.textContent : '';
        
        // Get original field ID if stored as a data attribute
        const originalId = fieldId.dataset.originalId || fieldId.value.trim();
        
        // Create a comprehensive field object with metadata
        const fieldData = {
          id: originalId,
          displayId: fieldId.value.trim(),
          value: fieldValue.value.trim(),
          name: fieldName,
          readonly: fieldId.readOnly,
          
          // Store field type and metadata
          type: row.dataset.fieldType || fieldValue.dataset.fieldType || (fieldValue.tagName === 'SELECT' ? 'select' : fieldValue.type),
          schema: row.dataset.schema ? JSON.parse(row.dataset.schema) : null,
          custom: row.dataset.fieldCustom !== undefined ? row.dataset.fieldCustom === 'true' : null,
          allowedValues: row.dataset.allowedValues ? JSON.parse(row.dataset.allowedValues) : []
        };
        
        // If it's a select, store the options
        if (fieldValue.tagName === 'SELECT') {
          fieldData.options = [];
          Array.from(fieldValue.options).forEach(option => {
            if (option.value) { // Skip empty placeholder options
              fieldData.options.push({
                value: option.value,
                text: option.textContent,
                selected: option.selected
              });
            }
          });
          
          // Ensure we flag this as a select type
          fieldData.type = 'select';
          
          // Create allowedValues array if it doesn't exist
          if (!fieldData.allowedValues || !fieldData.allowedValues.length) {
            fieldData.allowedValues = fieldData.options.map(option => ({
              id: option.value,
              name: option.text
            }));
          }
        }
        
        customFields.push(fieldData);
      }
    });
    
    // Create a simplified JSON object for the text area
    const customFieldsJson = {};
    customFields.forEach(field => {
      customFieldsJson[field.id] = field.value;
    });
    
    const jsonString = JSON.stringify(customFieldsJson, null, 2);
    customFieldsInput.value = jsonString;
    
    // Save complete field data to storage
    chrome.storage.sync.set({ 
      customFieldsArray: customFields,
      customFields: customFields,
      customFieldsJson: jsonString
    });
    
    console.log('Updated custom fields with metadata:', customFields);
  }

  // Helper function to add a field to custom fields
  function addFieldToCustomFields(field) {
    chrome.storage.sync.get(['customFieldsArray', 'customFieldsJson'], function(data) {
      const customFields = data.customFieldsArray || [];
      const customFieldsJsonObj = data.customFieldsJson ? JSON.parse(data.customFieldsJson) : {};
      
      // Check if field already exists
      if (!customFields.find(f => f.id === field.id)) {
        // Detect field type from name for date fields
        let detectedType = null;
        
        // If name contains "date", treat as date type
        if (field.name && field.name.toLowerCase().includes('date')) {
          detectedType = 'date';
          console.log(`Auto-detected date field from name: ${field.name}`);
        }
        
        // Create a field object with essential data
        const fieldData = {
          id: field.id,
          name: field.name || '',
          value: field.value || customFieldsJsonObj[field.id] || '',
          readonly: true,
          
          // Store field type appropriately
          type: detectedType || field.type || (field.schema ? field.schema.type : null),
          
          // Store field schema information if available
          schema: field.schema || null,
          
          // Store allowedValues if available (for dropdowns)
          allowedValues: field.allowedValues || []
        };
        
        customFields.push(fieldData);
        
        // Create the field row in the container
        createCustomFieldRow(fieldData);
        
        // Update storage
        chrome.storage.sync.set({ 
          customFieldsArray: customFields,
          customFields: customFields,
          customFieldsJson: JSON.stringify(customFieldsJsonObj, null, 2)
        }, function() {
          // Update the JSON textarea
          updateCustomFieldsJson();
        });
      }
    });
  }

  // Helper function to remove a field from custom fields
  function removeFieldFromCustomFields(fieldId) {
    chrome.storage.sync.get(['customFieldsArray', 'customFieldsJson'], function(data) {
      const customFields = data.customFieldsArray || [];
      const updatedFields = customFields.filter(field => field.id !== fieldId);
      
      chrome.storage.sync.set({ 
        customFieldsArray: updatedFields,
        customFields: updatedFields
      }, function() {
        updateCustomFieldsJson();
      });
    });
  }
  
  // Create custom field row with appropriate input type
  function createCustomFieldRow(field) {
    const newRow = document.createElement('div');
    newRow.className = 'custom-field-row';
    
    // Store field metadata as dataset attributes
    if (field.schema) {
      newRow.dataset.schema = JSON.stringify(field.schema);
    }
    if (field.type) {
      newRow.dataset.fieldType = field.type;
    }
    if (field.custom !== undefined) {
      newRow.dataset.fieldCustom = field.custom;
    }
    if (field.allowedValues) {
      newRow.dataset.allowedValues = JSON.stringify(field.allowedValues);
    }
    
    // Add field name label if available
    if (field.name) {
      const fieldLabel = document.createElement('div');
      fieldLabel.className = 'field-name-label';
      fieldLabel.textContent = field.name;
      // Store field ID as a data attribute for future reference
      fieldLabel.dataset.fieldId = field.id;
      newRow.appendChild(fieldLabel);
    }
    
    // Field inputs container
    const fieldInputs = document.createElement('div');
    fieldInputs.className = 'field-inputs';
    
    const fieldIdInput = document.createElement('input');
    fieldIdInput.type = 'text';
    fieldIdInput.className = 'custom-field-id';
    fieldIdInput.value = field.name || field.id;
    fieldIdInput.dataset.originalId = field.id; // Store the original field ID
    
    if (field.readonly) {
      fieldIdInput.readOnly = true;
      fieldIdInput.title = field.id;
    } else {
      fieldIdInput.placeholder = 'Field ID (e.g., customfield_10001)';
    }
    fieldInputs.appendChild(fieldIdInput);
    
    // Create appropriate input based on field type
    let fieldValueInput;
    
    // Store field type for debugging
    const fieldType = field.type || (field.schema ? (field.schema.custom || field.schema.type) : 'text');
    console.log(`Creating input for field ${field.id} (${field.name}) with type: ${fieldType}`);
    
    // First check if we have allowedValues for dropdown
    if (field.allowedValues && field.allowedValues.length > 0) {
      // Create select input for fields with allowed values
      console.log(`Field ${field.id} has ${field.allowedValues.length} allowed values`);
      fieldValueInput = document.createElement('select');
      fieldValueInput.className = 'custom-field-value';
      fieldValueInput.dataset.fieldType = 'select';
      
      // Add empty option
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '-- Select --';
      fieldValueInput.appendChild(emptyOption);
      
      // Add allowed values
      field.allowedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value.id || value.value || value.key || JSON.stringify(value);
        option.textContent = value.name || value.label || value.value || value.displayName || JSON.stringify(value);
        
        // Check if this option matches the default value
        if (field.defaultValue) {
          const defaultId = field.defaultValue.id || field.defaultValue.value || field.defaultValue.key;
          const valueId = value.id || value.value || value.key;
          if (defaultId === valueId) {
            option.selected = true;
          }
        }
        
        // Check if this option matches the current value
        if (field.value) {
          if (field.value === option.value || field.value === option.textContent) {
            option.selected = true;
          }
        }
        
        fieldValueInput.appendChild(option);
      });
    } else if (field.schema || field.type) {
      // Use schema or type info to determine input type
      const type = field.type || (field.schema ? field.schema.type : null);
      const custom = field.custom || (field.schema ? field.schema.custom : null);
      
      // Handle custom field types first if available
      if (custom) {
        if (custom.includes('multiselect') || custom.includes('labels') || 
            custom.includes('multi-checkbox') || custom.includes('checkboxes')) {
          fieldValueInput = document.createElement('input');
          fieldValueInput.type = 'text';
          fieldValueInput.className = 'custom-field-value';
          fieldValueInput.dataset.fieldType = 'array';
          fieldValueInput.placeholder = 'Values (comma separated)';
        } else if (custom.includes('userpicker') || custom.includes('userlist')) {
          fieldValueInput = document.createElement('input');
          fieldValueInput.type = 'text';
          fieldValueInput.className = 'custom-field-value';
          fieldValueInput.dataset.fieldType = 'user';
          fieldValueInput.placeholder = 'Username or account ID';
        } else if (custom.includes('textarea')) {
          fieldValueInput = document.createElement('textarea');
          fieldValueInput.className = 'custom-field-value';
          fieldValueInput.dataset.fieldType = 'textarea';
          fieldValueInput.placeholder = 'Enter text...';
          fieldValueInput.rows = 3;
        } else if (custom.includes('url')) {
          fieldValueInput = document.createElement('input');
          fieldValueInput.type = 'url';
          fieldValueInput.className = 'custom-field-value';
          fieldValueInput.dataset.fieldType = 'url';
          fieldValueInput.placeholder = 'https://...';
        } else if (custom.includes('date')) {
          fieldValueInput = document.createElement('input');
          fieldValueInput.type = 'date';
          fieldValueInput.className = 'custom-field-value';
          fieldValueInput.dataset.fieldType = 'date';
        } else {
          // Default for other custom types
          fieldValueInput = document.createElement('input');
          fieldValueInput.type = 'text';
          fieldValueInput.className = 'custom-field-value';
          fieldValueInput.dataset.fieldType = custom;
        }
      } else if (type) {
        // Handle standard types
        switch (type) {
          case 'date':
            fieldValueInput = document.createElement('input');
            fieldValueInput.type = 'date';
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = 'date';
            break;
            
          case 'datetime':
            fieldValueInput = document.createElement('input');
            fieldValueInput.type = 'datetime-local';
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = 'datetime';
            break;
            
          case 'number':
            fieldValueInput = document.createElement('input');
            fieldValueInput.type = 'number';
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = 'number';
            break;
            
          case 'boolean':
            fieldValueInput = document.createElement('select');
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = 'boolean';
            
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- Select --';
            
            const trueOption = document.createElement('option');
            trueOption.value = 'true';
            trueOption.textContent = 'Yes';
            
            const falseOption = document.createElement('option');
            falseOption.value = 'false';
            falseOption.textContent = 'No';
            
            fieldValueInput.appendChild(emptyOption);
            fieldValueInput.appendChild(trueOption);
            fieldValueInput.appendChild(falseOption);
            
            if (field.value === 'true') {
              trueOption.selected = true;
            } else if (field.value === 'false') {
              falseOption.selected = true;
            }
            break;
            
          case 'user':
            fieldValueInput = document.createElement('input');
            fieldValueInput.type = 'text';
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = 'user';
            fieldValueInput.placeholder = 'Username or account ID';
            break;
            
          case 'array':
            fieldValueInput = document.createElement('input');
            fieldValueInput.type = 'text';
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = 'array';
            fieldValueInput.placeholder = 'Values (comma separated)';
            break;
            
          default:
            // Default to text input
            fieldValueInput = document.createElement('input');
            fieldValueInput.type = 'text';
            fieldValueInput.className = 'custom-field-value';
            fieldValueInput.dataset.fieldType = type;
        }
      } else {
        // Default to text input if no schema or type info
        fieldValueInput = document.createElement('input');
        fieldValueInput.type = 'text';
        fieldValueInput.className = 'custom-field-value';
      }
    } else {
      // Default to text input if no schema or type info
      fieldValueInput = document.createElement('input');
      fieldValueInput.type = 'text';
      fieldValueInput.className = 'custom-field-value';
    }
    
    // Set value if provided and appropriate
    if (field.value) {
      if (fieldValueInput.tagName === 'TEXTAREA' || 
          fieldValueInput.tagName === 'INPUT' && fieldValueInput.type !== 'select') {
        fieldValueInput.value = field.value;
      }
    }
    
    // Set placeholder based on field type if not already set
    if (!fieldValueInput.placeholder && fieldValueInput.tagName !== 'SELECT') {
      fieldValueInput.placeholder = getValuePlaceholder(field);
    }
    
    fieldInputs.appendChild(fieldValueInput);
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-field';
    removeButton.textContent = '✕';
    removeButton.title = 'Remove field';
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
    
    return newRow;
  }
  
  // Helper function to get placeholder text based on field type
  function getValuePlaceholder(field) {
    if (!field.schema) return 'Field Value';
    
    // Check for custom field types first
    if (field.schema.custom) {
      if (field.schema.custom.includes('sprint')) {
        return 'Sprint ID or name';
      }
      if (field.schema.custom.includes('epic')) {
        return 'Epic ID or name';
      }
      if (field.schema.custom.includes('version')) {
        return 'Version ID or name';
      }
      if (field.schema.custom.includes('multiversion')) {
        return 'Version IDs (comma separated)';
      }
      if (field.schema.custom.includes('multiselect')) {
        return 'Values (comma separated)';
      }
      if (field.schema.custom.includes('labels') || field.schema.custom.includes('multi-checkbox')) {
        return 'Values (comma separated)';
      }
      if (field.schema.custom.includes('userpicker')) {
        return 'Username or account ID';
      }
      if (field.schema.custom.includes('multicheckboxes')) {
        return 'Values (comma separated)';
      }
      if (field.schema.custom.includes('textarea')) {
        return 'Text (supports multiple lines)';
      }
      if (field.schema.custom.includes('url')) {
        return 'https://example.com';
      }
    }
    
    // Then fall back to generic field types
    switch (field.schema.type) {
      case 'date':
        return 'YYYY-MM-DD';
      case 'datetime':
        return 'YYYY-MM-DD HH:MM';
      case 'time':
        return 'HH:MM';
      case 'number':
        return '0.00';
      case 'integer':
        return '0';
      case 'option':
      case 'array':
        return field.allowedValues ? 'Select a value' : 'Field Value';
      case 'user':
        return 'Username or account ID';
      case 'group':
        return 'Group name';
      case 'string':
        return field.name ? field.name + ' value' : 'Text';
      case 'project':
        return 'Project key';
      case 'priority':
        return 'Priority name';
      case 'issuetype':
        return 'Issue type name';
      case 'resolution':
        return 'Resolution name';
      case 'status':
        return 'Status name';
      default:
        return 'Field Value';
    }
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
        
        // Get original field ID if stored as a data attribute
        const originalId = fieldId.dataset.originalId || fieldId.value.trim();
        
        // Create a comprehensive field data object
        const fieldData = {
          id: originalId,
          displayId: fieldId.value.trim(), // The displayed ID might be different (like using name instead of ID)
          value: fieldValue.value.trim(),
          name: fieldName,
          readonly: fieldId.readOnly,
          
          // Store field type information
          type: row.dataset.fieldType || fieldValue.dataset.fieldType || (fieldValue.tagName === 'SELECT' ? 'select' : fieldValue.type),
          
          // If there's schema data stored on the row, include it
          schema: row.dataset.schema ? JSON.parse(row.dataset.schema) : null,
          
          // Include custom field flag if available
          custom: row.dataset.fieldCustom !== undefined ? row.dataset.fieldCustom === 'true' : null,
          
          // Include allowed values if available
          allowedValues: row.dataset.allowedValues ? JSON.parse(row.dataset.allowedValues) : []
        };
        
        // If it's a select, store the options
        if (fieldValue.tagName === 'SELECT') {
          fieldData.options = [];
          Array.from(fieldValue.options).forEach(option => {
            if (option.value) { // Skip empty placeholder options
              fieldData.options.push({
                value: option.value,
                text: option.textContent,
                selected: option.selected
              });
            }
          });
          
          // Ensure we flag this as a dropdown/select type
          fieldData.type = 'select';
          
          // Create allowedValues array if it doesn't exist
          if (!fieldData.allowedValues || !fieldData.allowedValues.length) {
            fieldData.allowedValues = fieldData.options.map(option => ({
              id: option.value,
              name: option.text
            }));
          }
        }
        
        customFields.push(fieldData);
      }
    });
    
    // Log the fields we're saving
    console.log('Saving custom fields with complete metadata:', customFields);
    
    // Save to both storage keys for compatibility
    chrome.storage.sync.set({ 
      customFieldsArray: customFields,
      customFields: customFields
    }, function() {
      // Also update the JSON textarea
      const customFieldsJson = {};
      customFields.forEach(field => {
        try {
          // Use the original field ID as the key in the JSON
          const key = field.id;
          
          // Try to parse the value as JSON first
          try {
            customFieldsJson[key] = JSON.parse(field.value);
          } catch (e) {
            // If not valid JSON, use as string
            customFieldsJson[key] = field.value;
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