# WhatsApp Scripts

A small Node.js WhatsApp bot that connects to WhatsApp via Baileys, replies to incoming messages, and stores session data locally.

## Features
- WhatsApp pairing and session persistence
- Simple reply flow for incoming messages
- Windows service wrapper support
- NVIDIA API-based replies

## Requirements
- Node.js
- npm

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the bot:
   ```bash
   set NVIDIA_API_KEY=your_api_key
   node robbin_bot.js
   ```

## Notes
- Session data is stored under the `session/` folder.
- The bot can also be run as a Windows service with the provided service scripts.
