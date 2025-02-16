// Add listener logging
console.log('Background script loaded and listening for messages');

chrome.runtime.onMessageExternal.addListener(
  async (message, sender, sendResponse) => {
    // Log all incoming messages
    console.log('Background received message:', {
      message,
      sender,
      senderOrigin: sender.origin
    });

    if (message.type === 'CODE_FROM_REACT') {
      try {
        console.log('Processing CODE_FROM_REACT message');
        
        // Find Riseup pad tabs
        const tabs = await chrome.tabs.query({
          url: 'https://pad.riseup.net/*'
        });
        console.log('Found Riseup pad tabs:', tabs);

        if (tabs.length > 0) {
          // Execute the content script in all frames
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id, allFrames: true },
            files: ['content.js']
          });

          // Try to send message to each frame until we get a success
          try {
            const response = await new Promise((resolve, reject) => {
              // Use chrome.tabs.sendMessage with a listener for multiple responses
              const listener = (response) => {
                if (response.status === 'success') {
                  // Remove listener once we get a success
                  chrome.runtime.onMessage.removeListener(listener);
                  resolve(response);
                }
              };
              
              chrome.runtime.onMessage.addListener(listener);
              
              // Send the message to all frames
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'TYPE_CODE',
                code: message.code
              });
              
              // Set a timeout to reject if no success found
              setTimeout(() => {
                chrome.runtime.onMessage.removeListener(listener);
                reject(new Error('No editor found in any frame'));
              }, 5000); // 5 second timeout
            });
            
            // If we got here, we found a working editor
            sendResponse({ status: 'success' });
            
          } catch (error) {
            console.error('Failed to find editor:', error);
            sendResponse({
              status: 'error',
              message: 'Failed to find editor in any frame'
            });
          }
        } else {
          console.log('No Riseup pad tabs found');
          sendResponse({
            status: 'error',
            message: 'No Riseup pad tab found'
          });
        }
      } catch (error) {
        console.error('Error in background script:', error);
        sendResponse({ status: 'error', message: error.message });
      }
    } else {
      console.log('Received message with unexpected type:', message.type);
    }
    return true;
  }
);

// Add startup logging
console.log('Extension ID:', chrome.runtime.id);

// Listen for any installation events
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details);
});

// Listen for any connection errors
chrome.runtime.onConnect.addListener((port) => {
  console.log('New connection established:', port);
});