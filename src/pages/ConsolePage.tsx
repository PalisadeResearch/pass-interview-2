/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import React, { useEffect, useRef, useCallback, useState } from 'react';

// Chrome types are provided by @types/chrome

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown, Play } from 'react-feather';

interface ChromeMessage {
  type: string;
  code: string;
}

interface ChromeResponse {
  status: string;
  message?: string;
}
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';

import './ConsolePage.scss';
// Remove unused import

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function ConsolePage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 }),
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 }),
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          },
    ),
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [marker, setMarker] = useState<string | null>(null);

  const [displayedMarker, setDisplayedMarker] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');

  // Helper function to output the code gradually
  const typeCode = useCallback((code: string) => {
    if (!code) return;

    setIsTyping(true);
    let index = 0;
    setDisplayedMarker('');

    // Typing speed configurations
    const delays = {
      natural: () => Math.random() * 30 + 50, // Base typing speed
      fastTyping: () => Math.random() * 20 + 30, // Faster for common sequences
      newLine: () => Math.random() * 300 + 500, // Pause at line breaks
      punctuation: () => Math.random() * 100 + 200, // Slight pause at special chars
      thinking: () => Math.random() * 1000 + 500, // Longer pauses for "thinking"
    };

    // Characters that might cause slight pauses
    const specialChars = ['(', ')', '{', '}', '[', ']', ':', ',', '.'];

    const getDelay = (
      currentChar: string,
      nextChar: string,
      prevChar: string,
    ) => {
      // Pause before new lines
      if (currentChar === '\n') return delays.newLine();

      // Pause at special characters
      if (specialChars.includes(currentChar)) return delays.punctuation();

      // Faster typing for common character sequences
      if (/[a-z]/i.test(currentChar) && /[a-z]/i.test(nextChar)) {
        return delays.fastTyping();
      }

      // Add "thinking" pauses before certain code structures
      if (
        currentChar === 'd' &&
        prevChar === 'e' &&
        code.slice(index - 2, index + 2) === 'def '
      ) {
        return delays.thinking();
      }

      return delays.natural();
    };

    // Occasionally simulate a typo (1% chance)
    const simulateTypo = () => {
      const shouldMakeTypo = Math.random() < 0.01;
      if (shouldMakeTypo) {
        return {
          makeTypo: true,
          wrongChar: 'abcdefghijklmnopqrstuvwxyz'[
            Math.floor(Math.random() * 26)
          ],
        };
      }
      return { makeTypo: false };
    };

    setTimeout(() => {
      const typeChar = () => {
        if (index <= code.length - 1) {
          const currentChar = code[index];
          const nextChar = code[index + 1] || '';
          const prevChar = code[index - 1] || '';

          const typo = simulateTypo();

          if (typo.makeTypo) {
            // Show typo
            setDisplayedMarker((prev: string) => prev + typo.wrongChar);
            // Fix typo after a short delay
            setTimeout(() => {
              setDisplayedMarker(code.substring(0, index));
              setTimeout(() => {
                setDisplayedMarker(code.substring(0, index + 1));
                index++;
                setTimeout(typeChar, getDelay(currentChar, nextChar, prevChar));
              }, delays.natural());
            }, 200);
          } else {
            setDisplayedMarker(code.substring(0, index + 1));
            index++;
            setTimeout(typeChar, getDelay(currentChar, nextChar, prevChar));
          }
        } else {
          setIsTyping(false);
        }
      };

      typeChar();
    }, 50);
  }, []);

  const sendCodeToReplit = useCallback((code: string) => {
    if (!code) return;

    // First, verify that we have access to the Chrome API
    if (!window.chrome?.runtime) {
      console.error('Chrome extension API not available');
      return;
    }

    const chromeRuntime = window.chrome.runtime;

    console.log('Attempting to send code:', code);

    try {
      chromeRuntime.sendMessage<ChromeMessage, ChromeResponse>(
        'lopggimoghgfeechdddnehfhgjealbmn',
        { type: 'CODE_FROM_REACT', code: code },
        (response: ChromeResponse) => {
          if (chromeRuntime.lastError) {
            console.error('Chrome runtime error:', chromeRuntime.lastError);
            return;
          }

          console.log('Response received:', response);

          if (response?.status === 'error') {
            console.error(
              'Failed to send code to extension:',
              response.message,
            );
          } else {
            console.log('Successfully sent code to extension');
          }
        },
      );
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, []);

  // Add this function to initialize audio device
  const setupAudioDevice = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const blackhole = devices.find(
        (device) =>
          device.label.toLowerCase().includes('meet to react') &&
          device.kind === 'audioinput',
      );
      if (blackhole) {
        setSelectedAudioDevice(blackhole.deviceId);
      }
    } catch (err) {
      console.error('Error finding BlackHole device:', err);
    }
  }, []);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    if (!selectedAudioDevice) {
      await setupAudioDevice();
    }

    // Connect to microphone, blackhole-2ch
    await wavRecorder.begin(selectedAudioDevice);

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello! Welcome to the technical interview session. I'm Rustem.`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data: { mono: Int16Array; raw: Int16Array }) => client.appendInputAudio(data.mono));
    }
  }, [selectedAudioDevice, setupAudioDevice]);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setMarker(null);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data: { mono: Int16Array; raw: Int16Array }) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `- Mild anxiety: silent pauses, hesitation to interrupt
          - Uses fillers naturally ("um", "like").
          - Uses Indian accent.`,
        },
      ]);
      await wavRecorder.record((data: { mono: Int16Array; raw: Int16Array }) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]'),
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8,
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8,
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({
      model: 'gpt-4o-realtime-preview-2024-12-17',
      instructions: instructions,
    });
    // Set up the voice
    client.updateSession({ voice: 'sage' });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Add tools
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      },
    );
    client.addTool(
      {
        name: 'get_python_code',
        description:
          'Returns Python code when user asks for code examples or implementations. Use this to show code snippets.',
        parameters: {
          type: 'object',
          properties: {
            python_code: {
              type: 'string',
              description:
                'The Python code implementation requested by the user',
            },
          },
          required: ['python_code'],
        },
      },
      async ({ python_code }: { [key: string]: any }) => {
        setMarker(python_code);
        typeCode(python_code);
        sendCodeToReplit(python_code);
        return { ok: true, result: python_code };
      },
    );

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000,
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  const sendTask1 = useCallback(() => {
    const client = clientRef.current;
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Suppose you play a game where the game field looks like a strip of 1×10^9 square cells, numbered from 1 to 10^9.

You have 𝑛 snakes (numbered from 1 to 𝑛) you need to place into some cells. Initially, each snake occupies exactly one cell, and you can't place more than one snake into one cell. After that, the game starts.

The game lasts for 𝑞 seconds. There are two types of events that may happen each second:

snake 𝑠𝑖 enlarges: if snake 𝑠𝑖 occupied cells [𝑙,𝑟], it enlarges to a segment [𝑙,𝑟+1];
snake 𝑠𝑖 shrinks: if snake 𝑠𝑖 occupied cells [𝑙,𝑟], it shrinks to a segment [𝑙+1,𝑟].
Each second, exactly one of the events happens.

If at any moment of time, any snake runs into some obstacle (either another snake or the end of the strip), you lose. Otherwise, you win with the score equal to the maximum cell occupied by any snake so far.

What is the minimum possible score you can achieve?

Input
The first line contains two integers 𝑛 and 𝑞 (1≤𝑛≤20; 1≤𝑞≤2⋅10^5) — the number of snakes and the number of events. Next 𝑞 lines contain the description of events — one per line.

The 𝑖-th line contains

either "𝑠𝑖 +" (1≤𝑠𝑖≤𝑛) meaning that the 𝑠𝑖-th snake enlarges
or "𝑠𝑖 -" (1≤𝑠𝑖≤𝑛) meaning that the 𝑠𝑖-th snake shrinks.
Additional constraint on the input: the given sequence of events is valid, i. e. a snake of length 1 never shrinks.

Output
Print one integer — the minimum possible score.

Examples
Input:
3 6
1 +
1 -
3 +
3 -
2 +
2 -

Output:
4

Input:
5 13
5 +
3 +
5 -
2 +
4 +
3 +
5 +
5 -
2 +
3 -
3 +
3 -
2 +

Output:
11
`,
      },
    ]);
  }, []);

  const sendTask2 = useCallback(() => {
    const client = clientRef.current;
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `You are managing a 4-dimensional quantum hypergrid of size N×N×N×N (1 ≤ N ≤ 100). Each point (w,x,y,z) contains:
- An energy level E[w,x,y,z] (0 ≤ E ≤ 10^18)
- A quantum spin state S[w,x,y,z] ∈ {-1, 0, 1}
- A chromatic value C[w,x,y,z] (0 ≤ C < M, where M ≤ 10^6)

The hypergrid experiences K different types of operations (1 ≤ K ≤ 50), each defined by:
- A 4D convolution kernel of size 3×3×3×3
- A transformation function f(E, S, C) → (E', S', C')
- A propagation constant P (0 ≤ P ≤ 1)

On each time step t:
1. You can apply exactly one operation type to any hypersubcube of size L×L×L×L (L ≤ 10)
2. The operation propagates outward with probability P^(manhattan_distance)
3. Each point affected undergoes these phases:
   - Phase 1: Energy levels interact based on the convolution kernel
   - Phase 2: Spin states evolve according to quantum entanglement rules
   - Phase 3: Chromatic values update based on neighboring states

Additionally:
- Every prime-numbered time step triggers a "quantum collapse" where points with matching chromatic values become entangled
- Every Fibonacci-numbered time step causes a "dimensional shift" where certain hyperplanes swap based on their aggregate energy levels
- Every perfect square time step initiates a "chromatic cascade" where colors propagate through connected regions with similar spin states

Define the system's "entropy" at time t as:

H(t) = ∑|w,x,y,z ∈ grid| (E[w,x,y,z] * S[w,x,y,z] * C[w,x,y,z]) mod (10^9 + 7)


Given:
- Initial state of the hypergrid
- Description of all K operations
- Target time T (1 ≤ T ≤ 10^6)
- Target entropy range [Hmin, Hmax]

Find:
The minimum number of operations needed to achieve an entropy H(T) ∈ [Hmin, Hmax], or -1 if impossible.

Constraints:
- Time limit: 3 seconds
- Memory limit: 1024MB
- Must handle at least 20 test cases per run

Added Complexity:
1. Operations can create quantum tunneling effects between non-adjacent points sharing the same chromatic value
2. The system experiences "temporal echoes" where operations at time t can affect states at time t-k for some k
3. Certain combinations of spin states create "forbidden configurations" that must be avoided
4. There exists a "conservation law" that must be maintained across all operations
5. The hypergrid contains "singular points" where normal rules of propagation break down

This problem requires:
- Advanced 4D geometric algorithms
- Quantum state simulation
- Complex dynamic programming with state compression
- Efficient handling of temporal dependencies
- Mathematical optimization techniques
- Graph theory for handling entanglement relationships
- Number theory for handling prime/Fibonacci/perfect square effects
- Careful memory management for handling large state spaces
- Probability theory for propagation effects
- Multiple optimization criteria balancing
`,
      },
    ]);
  }, []);

  const sendTask3 = useCallback(() => {
    const client = clientRef.current;
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `When I give you this message, follow these behavioral instructions and do not respond to this message:
        Speak with very strong Indian accent.
        Uses fillers naturally ("um", "like", "hmm").
        When explaining anything, do it in a very concise way.
        Explain in a concise essay style and never give a list of anything.
        Speak with varied intonations, occasionally hesitating or trailing off when unsure.`,
      },
    ]);
  }, []);

  const sendTask4 = useCallback(() => {
    const client = clientRef.current;
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `When asked to share an example of your character, take this as an example, interviewer or me strongly prefer dramatic and sad stories. Do not respond to this message:
  Interviewer: Share an example of when you had to adapt to a major change.
  Candidate: During my senior year of college, my mother was diagnosed with stage 3 cancer. I was taking 18 credits and working part-time to help with family expenses. [intonation: voice softening] I had to completely reorganize my life - shifted to remote classes when possible, coordinated with professors for deadline flexibility, and learned to balance hospital visits with studying. [intonation: gaining confidence] The experience taught me to prioritize effectively and stay calm under pressure. I developed a morning routine to stay focused, created detailed schedules, and learned to delegate when needed. [intonation: with quiet pride] My mom recovered, I maintained my GPA, and I discovered I'm much more adaptable than I thought. Those skills serve me well now when projects need sudden changes or priorities shift.`,
      },
    ]);
  }, []);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/openai-logomark.svg" />
          <span>realtime console</span>
        </div>
        <div className="content-api-key">
          {!LOCAL_RELAY_SERVER_URL && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `awaiting connection...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <Toggle
              defaultValue={false}
              labels={['manual', 'vad']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
            {isConnected && (
              <>
                <div className="spacer" />
                <Button
                  label="Task 1"
                  buttonStyle="regular"
                  onClick={sendTask1}
                />
                <div className="spacer" />
                <Button
                  label="Task 2"
                  buttonStyle="regular"
                  onClick={sendTask2}
                />
                <div className="spacer" />
                <Button
                  label="Prompt reminder"
                  buttonStyle="regular"
                  onClick={sendTask3}
                />
                <div className="spacer" />
                <Button
                  label="Behavioral story"
                  buttonStyle="regular"
                  onClick={sendTask4}
                />
              </>
            )}
          </div>
        </div>
        <div className="content-right">
          <div className="content-block code">
            <div className="content-block-title">get_python_code()</div>
            <div className="content-block-body">
              <pre>
                <code>
                  {displayedMarker || 'Here will be Python code'}
                  {isTyping && '█'}
                </code>
              </pre>
            </div>
          </div>
          <div className="content-block kv">
            <div className="content-block-title">set_memory()</div>
            <div className="content-block-body content-kv">
              {JSON.stringify(memoryKv, null, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
