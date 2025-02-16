console.log('Content script loaded');

// Function that will run in the page context to modify the editor
let isTyping = false;

function modifyEditor(code) {
  const body = document.getElementById('innerdocbody');
  if (!body) {
    console.log('Editor body not found');
    return false;
  }

  console.log('Found editor body, starting typing simulation');
  body.focus();

  // Fixed delays for consistent typing
  const TYPING_DELAY = 50;  // 50ms between characters
  const NEWLINE_DELAY = 100;  // 100ms for newlines

  // Common typing mistakes for each letter (common adjacent keys)
  const TYPO_MAP = {
    'a': ['s', 'q', 'z'],
    's': ['a', 'd', 'w'],
    'd': ['s', 'f', 'e'],
    'f': ['d', 'g', 'r'],
    'g': ['f', 'h', 't'],
    'h': ['g', 'j', 'y'],
    'i': ['u', 'o', 'k'],
    'j': ['h', 'k', 'u'],
    'k': ['j', 'l', 'i'],
    'l': ['k', ';', 'o'],
    'm': ['n', ',', 'j'],
    'n': ['b', 'm', 'h'],
    'o': ['i', 'p', 'l'],
    'p': ['o', '[', ';'],
    'q': ['w', 'a', '1'],
    'r': ['e', 't', 'f'],
    't': ['r', 'y', 'g'],
    'u': ['y', 'i', 'j'],
    'v': ['c', 'b', 'g'],
    'w': ['q', 'e', 's'],
    'x': ['z', 'c', 's'],
    'y': ['t', 'u', 'h'],
    'z': ['a', 'x', 's']
  };

  // Function to get random typing delay
  const getRandomDelay = (baseDelay) => {
    // Add random variation of ±30% to the base delay
    const variation = baseDelay * 0.6;
    return baseDelay + (Math.random() * variation * 6 - variation);
  };

  // Function to determine if we should make a typo
  const shouldMakeTypo = () => {
    // 5% chance of making a typo
    return Math.random() < 0.05;
  };

  // Function to get a random typo for a character
  const getTypo = (char) => {
    if (TYPO_MAP[char.toLowerCase()]) {
      const possibleTypos = TYPO_MAP[char.toLowerCase()];
      return possibleTypos[Math.floor(Math.random() * possibleTypos.length)];
    }
    return char;
  };

  // Modified typing simulation
  const simulateTyping = async (char) => {
    const shouldTypo = shouldMakeTypo();
    
    if (shouldTypo) {
      // Type the typo
      const typoChar = getTypo(char);
      simulateCharacterInput(typoChar);
      
      // Wait a short moment (100-200ms)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      
      // Delete the typo
      simulateCharacterInput('\b');
      
      // Wait another short moment (50-150ms)
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      
      // Type the correct character
      simulateCharacterInput(char);
    } else {
      simulateCharacterInput(char);
    }
  };

  // Function to simulate typing a character
  const simulateCharacterInput = (char) => {
    if (char === '\n') {
      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      body.dispatchEvent(enterEvent);
      return;
    }
    
    if (char === '\b') {
      // Simulate Backspace key press
      const backspaceEvent = new KeyboardEvent('keydown', {
        key: 'Backspace',
        code: 'Backspace',
        keyCode: 8,
        which: 8,
        bubbles: true
      });
      body.dispatchEvent(backspaceEvent);
      return;
    }
    
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(char);
    range.insertNode(textNode);
    range.collapse(false);
  };

  // Calculate indentation levels for each line
  const calculateIndentation = (lines) => {
    const indentLevels = [];
    let currentIndentLevel = 0;
    let inClass = false;  // Track if we're inside a class
    
    // Regular expressions for Python syntax
    const blockStart = /:\s*$/;  // Lines ending with :
    const dedentTriggers = /^\s*(return|pass|break|continue|raise|else|elif|except|finally)\b/;
    const emptyLine = /^\s*$/;
    const importLine = /^(from|import)\s+/;
    const functionDef = /^def\s+\w+\s*\([^)]*\):\s*$/;
    const classDef = /^class\s+\w+(\s*\([^)]*\))?\s*:\s*$/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Handle imports at root level
      if (importLine.test(trimmedLine)) {
        indentLevels.push({
          spaces: 0,
          shouldDedent: false,
          isEmptyLine: false
        });
        continue;
      }

      // Handle class definitions
      if (classDef.test(trimmedLine)) {
        inClass = true;
        indentLevels.push({
          spaces: 0,
          shouldDedent: false,
          isEmptyLine: false
        });
        currentIndentLevel++;
        continue;
      }

      // Handle function definitions
      if (functionDef.test(trimmedLine)) {
        // If we're in a class, ensure method is at class + 1 indent level
        if (inClass) {
          currentIndentLevel = 1;  // Reset to class body level
        }
        
        indentLevels.push({
          spaces: currentIndentLevel * 4,
          shouldDedent: false,
          isEmptyLine: false
        });
        currentIndentLevel++;
        continue;
      }

      // Handle empty lines
      if (emptyLine.test(line)) {
        indentLevels.push({
          spaces: currentIndentLevel * 4,
          shouldDedent: false,
          isEmptyLine: true
        });
        continue;
      }

      // Get the actual current indentation from the line
      const currentSpaces = line.match(/^[\s]*/)[0].length;

      // Check for dedentation
      if (currentSpaces < currentIndentLevel * 4 || dedentTriggers.test(trimmedLine)) {
        if (inClass && functionDef.test(trimmedLine)) {
          currentIndentLevel = 1;  // Reset to class body level for new methods
        } else {
          while (currentIndentLevel > 0 && currentSpaces < currentIndentLevel * 4) {
            currentIndentLevel--;
          }
        }
      }

      // Add indentation info for this line
      indentLevels.push({
        spaces: currentIndentLevel * 4,
        shouldDedent: dedentTriggers.test(trimmedLine),
        isEmptyLine: false
      });

      // Check if next line should be indented
      if (blockStart.test(trimmedLine)) {
        currentIndentLevel++;
      }
    }

    return indentLevels;
  };

  // Process the code line by line
  const lines = code.split('\n');
  const indentLevels = calculateIndentation(lines);
  let currentLine = 0;

  const typeLine = async () => {
    const line = lines[currentLine];
    const indentInfo = indentLevels[currentLine];
    let currentChar = 0;

    // Skip comments
    if (line.trim().startsWith('#')) {
      currentLine++;
      simulateCharacterInput('\n');
      setTimeout(typeLine, getRandomDelay(NEWLINE_DELAY));
      return;
    }

    const handleIndentation = async () => {
      const currentEditorIndent = getCurrentEditorIndentation();
      
      if (currentEditorIndent > indentInfo.spaces) {
        const backspacesNeeded = Math.floor((currentEditorIndent - indentInfo.spaces) / 4);
        for (let i = 0; i < backspacesNeeded; i++) {
          simulateCharacterInput('\b');
          await new Promise(resolve => setTimeout(resolve, getRandomDelay(TYPING_DELAY)));
        }
      }
      
      typeChar();
    };

    const getCurrentEditorIndentation = () => {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const currentLineContent = range.startContainer.textContent;
      const indentMatch = currentLineContent.match(/^[\s]*/);
      return indentMatch ? indentMatch[0].length : 0;
    };

    const typeChar = async () => {
      if (currentChar >= line.trim().length) {
        currentLine++;
        if (currentLine < lines.length) {
          simulateCharacterInput('\n');
          setTimeout(typeLine, getRandomDelay(NEWLINE_DELAY));
        } else {
          // Wait for a moment before starting final formatting
          await new Promise(resolve => setTimeout(resolve, NEWLINE_DELAY));
          
          // Add first newline and wait
          simulateCharacterInput('\n');
          await new Promise(resolve => setTimeout(resolve, NEWLINE_DELAY));
          
          // Add second newline and wait
          simulateCharacterInput('\n');
          await new Promise(resolve => setTimeout(resolve, NEWLINE_DELAY));
          
          // Get current indentation and remove it
          const currentIndent = getCurrentEditorIndentation();
          console.log(currentIndent);
          for (let i = 0; i < currentIndent / 4; i++) {
            simulateCharacterInput('\b');
            await new Promise(resolve => setTimeout(resolve, TYPING_DELAY));
          }
          
          // Only mark typing as complete after all operations finish
          isTyping = false;
          console.log('Typing simulation complete with final formatting');
        }

        return;
      }

      const char = line.trim()[currentChar];
      await simulateTyping(char);
      currentChar++;
      
      // Variable typing speed based on character type
      let delay = TYPING_DELAY;
      if ('.,;:!?'.includes(char)) {
        delay *= 1.5; // Slower for punctuation
      } else if (' '.includes(char)) {
        delay *= 1.2; // Slightly slower for spaces
      }
      
      setTimeout(typeChar, getRandomDelay(delay));
    };

    handleIndentation();
  };

  // Start typing simulation
  typeLine();
  return true;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.type === 'TYPE_CODE') {
    if (isTyping) {
      sendResponse({ status: 'busy' });
      return true;
    }

    try {
      isTyping = true;
      const success = modifyEditor(message.code);
      
      if (success) {
        // Add completion callback to reset lock
        const originalTypeLine = typeLine;
        typeLine = async () => {
          if (currentLine >= lines.length) {
            isTyping = false;
          }
          return originalTypeLine();
        };
        
        sendResponse({ status: 'success' });
      } else {
        isTyping = false;
        sendResponse({ status: 'not_found' });
      }
    } catch (error) {
      isTyping = false;
      sendResponse({ status: 'error', message: error.message });
    }
  }
  return true;
});
