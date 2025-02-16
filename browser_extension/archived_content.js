// this is for replit

if (!window.codeTyperInstance) {
    console.log('Initializing CodeTyper...');
  
    class CodeTyper {
      constructor() {
        console.log('CodeTyper constructor called');
        this.typingQueue = '';
        this.isTyping = false;
        this.TYPING_SPEED = 50;
        this.indentationLevels = []; // Add this new array to store indentation levels
  
        // Add listener immediately
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          console.log('Content script received message:', message);
          if (message.type === 'TYPE_CODE') {
            this.addToQueue(message.code);
            sendResponse({ status: 'queued' });
          }
          return true; // Keep message channel open for async response
        });
  
        console.log('CodeTyper initialized successfully');
      }
  
      calculateIndentationLevels(code) {
        const lines = code.split('\n');
        const levels = [];
        let blockStack = [0]; // Stack to track block indentation levels
  
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          const indentMatch = line.match(/^[\s\t]*/);
          const currentIndent = indentMatch ? indentMatch[0].length : 0;
  
          // If line is empty, skip it
          if (!trimmedLine) continue;
  
          // Check if we're dedenting
          while (
            blockStack.length > 1 &&
            currentIndent < blockStack[blockStack.length - 1]
          ) {
            blockStack.pop();
          }
  
          // Store the current indentation level
          levels.push(currentIndent);
  
          // If this line starts a new block (ends with :)
          if (trimmedLine.endsWith(':')) {
            // Next line should be indented more than current
            blockStack.push(currentIndent + 4); // Python typically uses 4 spaces
          }
        }
  
        console.log('Calculated indent levels:', levels);
        return levels;
      }
  
      addToQueue(code) {
        this.indentationLevels = this.calculateIndentationLevels(code);
  
        // Remove comments and clean up the code
        const cleanCode = code
          .split('\n')
          .map((line) => {
            // Skip comment-only lines
            if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
              return '';
            }
  
            // Remove inline comments
            return line
              .replace(/\/\/.*$/, '') // Remove JS/C++ style comments
              .replace(/#.*$/, '') // Remove Python style comments
              .trim(); // Remove all whitespace, let Replit handle indentation
          })
          .filter((line) => line.length > 0)
          .join('\n');
  
        console.log('Adding to queue:', cleanCode.length, 'characters');
        this.typingQueue += cleanCode;
        if (!this.isTyping) {
          console.log('Starting typing process...');
          this.typeNextCharacter();
        } else {
          console.log('Already typing, added to queue');
        }
      }
  
      async typeNextCharacter() {
        const activeLine = document.querySelector('.cm-replit-active-line');
  
        if (!activeLine) {
          console.log('Active line not found, retrying in 500ms...');
          setTimeout(() => this.typeNextCharacter(), 500);
          return;
        }
  
        if (this.typingQueue.length === 0) {
          this.isTyping = false;
          this.indentationLevels = []; // Reset indentation levels
          console.log('Queue empty, typing complete');
          return;
        }
  
        this.isTyping = true;
        const char = this.typingQueue[0];
        this.typingQueue = this.typingQueue.slice(1);
  
        try {
          activeLine.focus();
  
          if (char === '\n') {
            // Get current and next indentation levels
            const currentIndent = this.indentationLevels[0] || 0;
            const nextIndent = this.indentationLevels[1] || 0;
  
            // Remove the current indentation level as we've used it
            this.indentationLevels.shift();
  
            // Press Enter
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            activeLine.dispatchEvent(enterEvent);
  
            // If next line needs to be dedented
            if (nextIndent < currentIndent) {
              console.log('Dedenting from', currentIndent, 'to', nextIndent);
              await new Promise((resolve) => setTimeout(resolve, 50));
  
              const newActiveLine = document.querySelector(
                '.cm-replit-active-line',
              );
              if (newActiveLine) {
                // Calculate exact number of backspaces needed
                const backspaceCount = (currentIndent - nextIndent) / 4; // Using 4 spaces as Python standard
                for (let i = 0; i < backspaceCount; i++) {
                  const backspaceEvent = new KeyboardEvent('keydown', {
                    key: 'Backspace',
                    code: 'Backspace',
                    keyCode: 8,
                    which: 8,
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                  });
                  newActiveLine.dispatchEvent(backspaceEvent);
                  await new Promise((resolve) => setTimeout(resolve, 10));
                }
              }
            }
          } else {
            // Handle regular characters
            const textNode = document.createTextNode(char);
            activeLine.appendChild(textNode);
  
            const inputEvent = new InputEvent('input', {
              inputType: 'insertText',
              data: char,
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            activeLine.dispatchEvent(inputEvent);
  
            // Move cursor right
            const rightArrowEvent = new KeyboardEvent('keydown', {
              key: 'ArrowRight',
              code: 'ArrowRight',
              keyCode: 39,
              which: 39,
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            activeLine.dispatchEvent(rightArrowEvent);
          }
  
          console.log(`Typed character: ${char === '\n' ? '\\n' : char}`);
        } catch (error) {
          console.error('Error typing character:', error);
        }
  
        setTimeout(() => this.typeNextCharacter(), this.TYPING_SPEED);
      }
    }
  
    window.codeTyperInstance = new CodeTyper();
  } else {
    console.log('CodeTyper already initialized');
  }
  