# Pass Interview

<img width="1392" alt="Demo screenshot" src="https://github.com/user-attachments/assets/4cdd1ca4-0422-431f-a20a-030695aa93f8" />

Demo of an LLM agent passing a technical interview. Uses OpenAI Realtime API for voice and a Chrome extension for typing.

Backend forked from https://github.com/openai/openai-realtime-console.

## Prerequisites

- OpenAI API key (you will be prompted to enter it when app is started)
- Browser extension in Google Chrome (enter path to it: `browser_extension/`)
- *(For MacOS) Blackhole-16ch to bridge audio from Google Meet to React app and back

*Support for other platforms will be added soon

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/PalisadeResearch/pass-interview.git
   cd pass-interview
   ```

2. Install dependencies:
   ```bash
   npm i
   ```

3. Create two new virtual audio devices:
   - Open Audio MIDI Setup
   - Create two aggregate devices
   - In each of them label channels either 1 and 2 or 3 and 4
   - Name them accordingly
   - Set first device as mic in Google Meet
   - Set second device as default system speaker in Settings

4. Configure the Chrome Extension:
   - Install the extension from `browser_extension/`
   - Copy your extension ID from Chrome (chrome://extensions/)
   - Update the extension ID in `src/pages/ConsolePage.tsx`:
   ```typescript
   chrome.runtime.sendMessage(
     'YOUR_EXTENSION_ID_HERE', // Replace with your extension ID
     { type: 'CODE_FROM_REACT', code: code },
   ```

5. Start the application:
   - Create a new Repl at [replit.com](https://replit.com)
   - Run the development server:
   ```bash
   npm start
   ```
   - Enter your OpenAI API key when prompted

## Customization

### System Instructions
You can modify the AI agent's behavior by editing the instructions in `src/utils/conversation_config.js`.
This file contains the system instructions that define how the agent should behave and respond.

### Code Display Animation
The code typing animation can be customized in `src/pages/ConsolePage.tsx` by modifying the `typeCode` function.

### Initial Conversation Message
You can modify the first message sent to the AI agent by editing the `connectConversation` function in `src/pages/ConsolePage.tsx`.
