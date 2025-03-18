/**
 * Email to Jira - Background Script
 * Handles background operations for the extension
 */

// Listen for installation event
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // Set default options on install
    chrome.storage.sync.set({
      defaultIssueType: 'Task'
    });
    
    // Open options page on install
    chrome.runtime.openOptionsPage();
  }
  
  // Register content script
  injectContentScriptToExistingTabs();
});

// Ensure content script is injected when tabs are updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only inject when the page has completed loading
  if (changeInfo.status === 'complete') {
    const url = tab.url || '';
    if (isEmailPage(url)) {
      injectContentScript(tabId);
    }
  }
});

// Handle browser action click
chrome.action.onClicked.addListener(function(tab) {
  // Check if current page is an email client
  const url = tab.url || '';
  const isEmailPage = url.includes('mail.google.com') || 
                      url.includes('outlook.office.com') || 
                      url.includes('outlook.live.com');
  
  // Open side panel
  chrome.sidePanel.open({ tabId: tab.id });
  
  // Inject content script if on email page
  if (isEmailPage) {
    // Ensure content script is loaded
    injectContentScript(tab.id);
  }
});

// Helper function to check if we're on a supported email page
function isEmailPage(url) {
  return url.includes('mail.google.com') || 
         url.includes('outlook.office.com') || 
         url.includes('outlook.live.com');
}

// Inject content script to a specific tab
function injectContentScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }).then(() => {
    console.log('Content script injected to tab', tabId);
  }).catch(error => {
    console.error('Error injecting content script:', error);
  });
}

// Inject content script to all existing tabs that match email patterns
function injectContentScriptToExistingTabs() {
  chrome.tabs.query({
    url: [
      '*://mail.google.com/*',
      '*://*.mail.google.com/*',
      '*://outlook.office.com/*',
      '*://outlook.live.com/*'
    ]
  }, function(tabs) {
    for (const tab of tabs) {
      injectContentScript(tab.id);
    }
  });
} 