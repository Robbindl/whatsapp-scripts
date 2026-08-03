# WhatsApp Scripts

A small Node.js WhatsApp bot that connects to WhatsApp via Baileys, replies to incoming messages, and stores session data locally.

## Features
- WhatsApp pairing and session persistence
- Simple reply flow for incoming messages
- Windows service wrapper support
- AI-powered replies via an API provider of your choice

## Requirements
- Node.js
- npm

## How it runs
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your AI API key:
   ```bash
   set NVIDIA_API_KEY=your_api_key
   ```
   If you want to use another AI provider, update the request code in `robbin_bot.js` to match that provider.
3. Start the bot:
   ```bash
   node robbin_bot.js
   ```
4. Scan the QR code shown in the terminal or saved in `qr-code.txt` from your phone to link WhatsApp.
5. Once connected, incoming messages will be received and replied to automatically.

## Notes
- Session data is stored under the `session/` folder.
- The bot can also be run as a Windows service with the provided service scripts.
