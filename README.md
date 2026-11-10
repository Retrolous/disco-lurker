# Disco-lurker
A basic Discord bot allowing users to navigate a local music folder in a manner similar to a terminal, and queue songs for playback in a voice channel.

The bot was developed for a single album listening session, so its feature set is deliberately minimal. A "now playing" command displaying the track name and duration, for example, is not implemented, although it could likely be added using `ffprobe`.

## Features

- Terminal-style navigation of the music folder (`ls`, `cd` and a working directory)
- Queueing of individual songs or entire folders
- Playback controls: skip, skip to a position, seek, remove from queue, pause and clear
- Audio streaming to a Discord voice channel via `ffmpeg`
- Restriction to a configured starting directory, preventing navigation to the rest of the filesystem

## Setup

1. Install **ffmpeg** and ensure it is accessible from your shell; the bot cannot play audio without it.
2. Run `npm install`, as the project uses `discord.js` and `@discordjs/voice`.
3. Create a `config.json` file in the same directory as `index.js`:
   ```json
   {
     "token": "your bot token",
     "starting_directory": "/path/to/your/music"
   }
   ```
4. Start the bot with `node index.js`.

Any format supported by ffmpeg can be played. When queueing a folder, the bot recognises `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.webm` and `.opus` files. Additional extensions can be added to the `isAudioFile` function.

## Status

The project is incomplete. It was originally built around prefix-based text commands, and a migration to slash commands was under way when it had met its intended purpose. As a result, `index.js` still contains the older command handlers and commented-out code.

## Tech used

Node.js · discord.js · @discordjs/voice · ffmpeg
