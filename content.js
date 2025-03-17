/**
 * Email to Jira - Content Script
 * This script extracts email data from supported email clients.
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  if (request.action === 'extractEmailData') {
    try {
      const emailData = extractEmailData();
      console.log('Extracted email data:', emailData);
      sendResponse(emailData);
    } catch (error) {
      console.error('Error in extractEmailData:', error);
      sendResponse({
        success: false,
        error: `Error extracting data: ${error.message}`
      });
    }
  }
  return true; // Keep the message channel open for async response
});

/**
 * Extract email data from the current page
 * Supports Gmail and Outlook
 */
function extractEmailData() {
  const url = window.location.href;
  console.log('Current URL:', url);
  
  // Check which email client we're on
  if (url.includes('mail.google.com')) {
    return extractGmailData();
  } else if (url.includes('outlook.office.com') || url.includes('outlook.live.com')) {
    return extractOutlookData();
  } else {
    return {
      success: false,
      error: 'Unsupported email client. Currently supporting Gmail and Outlook only.'
    };
  }
}

/**
 * Extract email data from Gmail
 * Updated selectors for modern Gmail interface
 */
function extractGmailData() {
  try {
    console.log('Attempting to extract Gmail data...');
    
    // Multiple possible selectors for Gmail's email view
    const subjectSelectors = [
      'h2[data-thread-perm-id]',                  // Traditional view
      '.ha h2',                                   // Modern view
      '.nH .hP',                                  // Another variation
      '[role="heading"][tabindex="-1"]',          // Role-based selector
      '[data-thread-id] h2',                      // Thread-based selector
      '[data-message-id] h2'                      // Message-based selector
    ];
    
    // Try to find subject using multiple selectors
    let subjectElement = null;
    for (const selector of subjectSelectors) {
      subjectElement = document.querySelector(selector);
      if (subjectElement) {
        console.log(`Found subject with selector: ${selector}`);
        break;
      }
    }
    
    const subject = subjectElement ? subjectElement.textContent.trim() : '';
    console.log('Extracted subject:', subject);
    
    if (!subject) {
      console.warn('Could not find email subject. Email might not be open or UI selectors need updating.');
    }
    
    // Multiple possible selectors for sender info
    const fromSelectors = [
      '.gD',                                      // Traditional view
      '.gb_vd',                                   // Modern view
      '[email]',                                  // Email attribute
      '.bA4 span',                                // Another variation
      '[data-hovercard-id]',                      // Hovercard selector
      '[data-tooltip-class="email"]'              // Tooltip selector
    ];
    
    // Try to find sender info
    let fromElement = null;
    let fromName = '';
    let fromEmail = '';
    
    for (const selector of fromSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Check if this is likely a sender element (near the top of email)
        if (el.getAttribute('email') || 
            (el.textContent && el.textContent.includes('@')) || 
            el.getAttribute('data-hovercard-id')) {
          fromElement = el;
          fromEmail = el.getAttribute('email') || el.getAttribute('data-hovercard-id') || '';
          fromName = el.textContent.trim();
          console.log(`Found sender with selector: ${selector}`);
          break;
        }
      }
      if (fromElement) break;
    }
    
    // Try a different approach for body content
    const bodySelectors = [
      '.a3s',                                     // Traditional view
      '.ii.gt',                                   // Common body class
      '[data-message-id] .ii.gt',                 // Message-based selector
      '.gs .ii.gt',                               // Another variation
      '[role="main"] .ii.gt',                     // Role-based selector
      '.adn .gs .ii.gt'                           // Nested selector
    ];
    
    let bodyElement = null;
    for (const selector of bodySelectors) {
      bodyElement = document.querySelector(selector);
      if (bodyElement) {
        console.log(`Found body with selector: ${selector}`);
        break;
      }
    }
    
    const body = bodyElement ? bodyElement.innerText.trim() : '';
    
    // Extract date - various selectors
    const dateSelectors = [
      '.g3',                                      // Traditional view
      '.gH .g3',                                  // Nested view
      '[data-tooltip="Show details"] + [role="gridcell"]', // Modern view
      '.ads [role="gridcell"]',                   // Another variation
      '.ii [role="gridcell"]',                    // Role-based
      '[data-message-id] .utdU2e',                // Message date indicator
      '.aDM span'                                 // Another variation
    ];
    
    let dateElement = null;
    for (const selector of dateSelectors) {
      dateElement = document.querySelector(selector);
      if (dateElement && dateElement.textContent) {
        console.log(`Found date with selector: ${selector}`);
        break;
      }
    }
    
    const date = dateElement ? dateElement.textContent.trim() : '';
    
    // Try to get recipients
    const toSelectors = [
      '.g2',                                      // Traditional
      '[data-thread-id] [data-hovercard-id]',     // Modern
      '.adn [data-hovercard-id]',                 // Another variation
      '[data-tooltip-class="email"]:not(.gD)'     // Using tooltip but not sender
    ];
    
    let toElements = [];
    for (const selector of toSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        console.log(`Found recipients with selector: ${selector}`);
        toElements = elements;
        break;
      }
    }
    
    const to = Array.from(toElements)
      .map(el => el.getAttribute('email') || el.getAttribute('data-hovercard-id') || el.textContent.trim())
      .filter(Boolean)
      .join(', ');
    
    // Check if we have at least minimal information
    if (!subject && !body) {
      console.warn('Could not extract essential email data. Make sure you have an email open.');
      return {
        success: false,
        error: 'No email found or email content couldn\'t be accessed. Make sure you have an email open.'
      };
    }
    
    // Return whatever we could extract
    return {
      success: true,
      subject,
      from: fromName ? `${fromName} ${fromEmail ? '<' + fromEmail + '>' : ''}` : '',
      to,
      date,
      body
    };
  } catch (error) {
    console.error('Error extracting Gmail data:', error);
    return {
      success: false,
      error: 'Failed to extract email data: ' + error.message
    };
  }
}

/**
 * Extract email data from Outlook
 * Updated selectors for modern Outlook interface
 */
function extractOutlookData() {
  try {
    console.log('Attempting to extract Outlook data...');
    
    // Multiple selectors for email reading panes and subjects
    const readingPaneSelectors = [
      '.ReadingPaneContent',                      // Traditional view
      '[role="main"] [role="region"]',            // Role-based
      '.ZtMcN',                                   // Modern class
      '.IjzWp',                                   // Another variation
      '#ReadingPaneContainerId'                   // ID-based
    ];
    
    // Check if there's a reading pane visible
    let readingPane = null;
    for (const selector of readingPaneSelectors) {
      readingPane = document.querySelector(selector);
      if (readingPane) {
        console.log(`Found reading pane with selector: ${selector}`);
        break;
      }
    }
    
    if (!readingPane) {
      console.warn('No reading pane found. Email might not be open.');
      return {
        success: false,
        error: 'No email found. Make sure you have an email open in Outlook.'
      };
    }
    
    // Multiple selectors for subject
    const subjectSelectors = [
      '[role="heading"][aria-level="2"]',         // Role-based
      '.rps_5781',                                // Class-based
      '.FqIVwb',                                  // Modern class
      '.XbIp4d',                                  // Another variation
      '.item-subject',                            // Item class
      '.dVbCub'                                   // Another variation
    ];
    
    let subjectElement = null;
    for (const selector of subjectSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Check if it's likely a subject (inside the reading pane)
        if (readingPane.contains(el) || 
            document.querySelector('.allowTextSelection').contains(el)) {
          subjectElement = el;
          console.log(`Found subject with selector: ${selector}`);
          break;
        }
      }
      if (subjectElement) break;
    }
    
    // If direct selector approach failed, try broader selectors
    if (!subjectElement) {
      const possibleSubjects = document.querySelectorAll('[role="heading"]');
      for (const el of possibleSubjects) {
        if (el.getAttribute('aria-level') === '2' || 
            el.getAttribute('aria-level') === '1' ||
            el.className.includes('subject')) {
          subjectElement = el;
          console.log('Found subject using broad heading selector');
          break;
        }
      }
    }
    
    const subject = subjectElement ? subjectElement.textContent.trim() : '';
    console.log('Extracted subject:', subject);
    
    // Try various sender selectors
    const fromSelectors = [
      '.ReadingPaneContent .from',                // Traditional
      '[role="region"] [role="heading"] + [role="link"]', // Modern
      '.hcptT',                                   // Class-based
      '.GNqVo',                                   // Another variation
      '.flexible-sender',                         // Descriptive class
      '.uniqueSecondaryText',                     // Another class
      '.bidi_text'                                // Bidirectional text
    ];
    
    let fromElement = null;
    for (const selector of fromSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (readingPane.contains(el) || 
            el.closest('[role="main"]')) {
          fromElement = el;
          console.log(`Found sender with selector: ${selector}`);
          break;
        }
      }
      if (fromElement) break;
    }
    
    // If selectors fail, try to find from text near subject
    if (!fromElement && subjectElement) {
      const potentialElements = [];
      let current = subjectElement.previousElementSibling;
      while (current && potentialElements.length < 5) {
        potentialElements.push(current);
        current = current.previousElementSibling;
      }
      
      current = subjectElement.nextElementSibling;
      while (current && potentialElements.length < 10) {
        potentialElements.push(current);
        current = current.nextElementSibling;
      }
      
      for (const el of potentialElements) {
        if (el.textContent && (el.textContent.includes('@') || 
            el.textContent.toLowerCase().includes('from'))) {
          fromElement = el;
          console.log('Found sender using proximity to subject');
          break;
        }
      }
    }
    
    const from = fromElement ? fromElement.textContent.trim() : '';
    
    // Try to find recipients
    const toSelectors = [
      '.ReadingPaneContent .toRecipients',        // Traditional
      '[aria-label="To"]',                        // Aria-label
      '.UvtIbe',                                  // Class-based
      '.bidi_text:not(.from)',                    // Not from
      '[role="link"]:not(.from)'                  // Role-based not from
    ];
    
    let toElement = null;
    for (const selector of toSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if ((readingPane && readingPane.contains(el)) || 
            el.closest('[role="main"]')) {
          if (el.textContent && (el.textContent.includes('@') || 
              el.getAttribute('aria-label') === 'To')) {
            toElement = el;
            console.log(`Found recipients with selector: ${selector}`);
            break;
          }
        }
      }
      if (toElement) break;
    }
    
    const to = toElement ? toElement.textContent.trim() : '';
    
    // Try to find date
    const dateSelectors = [
      '.ReadingPaneContent .sentDate',            // Traditional
      '.datetime',                                // Class-based
      '.xAFpj',                                   // Modern class
      '.eZuwY',                                   // Another variation
      '[role="main"] time',                       // Time element
      '.rps_4ea3'                                 // Another class
    ];
    
    let dateElement = null;
    for (const selector of dateSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if ((readingPane && readingPane.contains(el)) || 
            el.closest('[role="main"]')) {
          dateElement = el;
          console.log(`Found date with selector: ${selector}`);
          break;
        }
      }
      if (dateElement) break;
    }
    
    const date = dateElement ? dateElement.textContent.trim() : '';
    
    // Try to find body content
    const bodySelectors = [
      '.ReadingPaneContent .message-body',        // Traditional
      '[role="main"] [role="presentation"]',      // Role-based
      '.allowTextSelection',                      // Text selection
      '.bMpKBe',                                  // Class-based
      '.aZjzPe',                                  // Another class
      '.TcKJpc'                                   // Another variation
    ];
    
    let bodyElement = null;
    for (const selector of bodySelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Verify it's a body by checking content length and location
        if (el.textContent && el.textContent.length > 50 && 
            ((readingPane && readingPane.contains(el)) || 
             el.closest('[role="main"]'))) {
          bodyElement = el;
          console.log(`Found body with selector: ${selector}`);
          break;
        }
      }
      if (bodyElement) break;
    }
    
    // If we still can't find the body, look for anything with substantial text content
    if (!bodyElement) {
      const allElements = readingPane ? 
                        readingPane.querySelectorAll('*') : 
                        document.querySelectorAll('[role="main"] *');
                        
      for (const el of allElements) {
        if (el.textContent && el.textContent.length > 100 && 
            !el.querySelector('input, button, select') && 
            el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
          bodyElement = el;
          console.log('Found body using content length heuristic');
          break;
        }
      }
    }
    
    const body = bodyElement ? bodyElement.innerText.trim() : '';
    
    // Check if we have at least minimal information
    if (!subject && !body) {
      console.warn('Could not extract essential email data from Outlook');
      return {
        success: false,
        error: 'No email content could be accessed. Make sure you have an email open in Outlook.'
      };
    }
    
    return {
      success: true,
      subject,
      from,
      to,
      date,
      body
    };
  } catch (error) {
    console.error('Error extracting Outlook data:', error);
    return {
      success: false,
      error: 'Failed to extract email data: ' + error.message
    };
  }
}

// Helper function to clean up HTML content if needed
function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
} 