//#region Imports

// necessary to allow the bot to interact with guilds
const { token, starting_directory } = require("./config.json");
const { Client, Events, GatewayIntentBits, Collection, MessageFlags } = require("discord.js");

// basics for running and maintaining an audio stream
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} = require("@discordjs/voice");

// modules necessary for interacting with the file system
// used both for commands and streaming audio
const { spawn } = require("child_process");
const path = require("node:path");
const fs = require('node:fs');
const { start } = require("node:repl");

//#endregion

//#region Client set-up
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// store commands in a map, so they can be easily referenced by name
client.commands = new Collection();

// store any relevant information regarding playing status  
client.player = {
  connected: false,
  playing: false,
  workingTextChannelID: undefined,
  workingVoiceChannelID: undefined,
  playlist: [],
  // working directory
  wd: starting_directory,
  connection: undefined,
  player: createAudioPlayer()
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag}`);
});

client.login(token);
//#endregion

//#region Command set-up
// get the list of command folders i.e. subsections
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

// for each subsection
for (const folder of commandFolders) {
  // get the list of commands i.e. js files
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  // for each command
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
    // load it and save it within the Collection with the key as the command name and value as exported module (slash command and ex function)
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
      // ensure commands are properly formatted
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// if the user creates a slash command
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return; 
  const command = interaction.client.commands.get(interaction.commandName);

  // if the command doesn't exist
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
    // attempt to execute it
		await command.execute(interaction);
	} catch (error) {
		console.error(error);

    // if there was an initial reply
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
	console.log(interaction);
});

//#endregion

// when the current song ends
client.player.player.on(AudioPlayerStatus.Idle, () => {
  try {
    playlist.shift();
    playNextSong();
  } catch (error) {
    console.error(error);
  }
});

client.player.player.on("error", (error) => {
  console.error(`Error: ${error.message}`);
});

// // slash commands would probably be better but i'm still stuck in 2020


//   currentTextChannelId = message.channel.id;

//   switch (message.content) {
//     case "-leave":
//       resetState();
//       break;
//     case "-ls":
//       listCurrentDirectory(message);
//       break;
//     case "-wd": //output the current working directory
//       message.reply(wd);
//       break;
//     case "-resetdir":
//       wd = starting_directory;
//       break;
//     case "-queue":
//       displayQueue(message);
//       break;
//     case "-clear":
//       playlist.splice(1);
//       break;
//     case "-playfolder":
//       handleMassPlaying(message);
//       break;
//     case "-pause":
//       player.pause();
//       break;
//     case "-skip": // remove the current song from the queue (which will be the first) and play the next one
//       if(playlist.length > 0){
//         playlist.shift();
//         playNextSong();
//       } else {
//         message.reply("You need to play a song to skip it.")
//       }
//       break;
//   }

//   if (message.content.startsWith("-cd")) {
//     changeDirectory(message);
//   }

//   if (message.content.startsWith("-play ")) {
//     handlePlaying(message);
//   }

//   if (message.content.startsWith("-seek ")) {
//     handleSeeking(message);
//   }

//   if(message.content.startsWith("-remove ")){
//     handleRemoving(message);
//   }

//   if(message.content.startsWith("-skipto ")){
//     handleSkippingTo(message);
//   }

function handleSkippingTo(message){
    let skiptoArgs = message.content.toString().slice(8);
    if(isNaN(skiptoArgs) || playlist.length < skiptoArgs) message.reply("Not a valid position.");
    playlist.splice(0, skiptoArgs - 1);
    playNextSong();
}

function handleSeeking(message){
  let seekArgs = message.content.toString().slice(6);
  if(isNaN(seekArgs)) message.reply("Not a valid position.");
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      playlist[0],
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-ss",
      seekArgs.toString(),
      "pipe:1",
      
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    player.play(resource);
}

function handleRemoving(message){
  let removeArgs = message.content.toString().slice(8);
  if(isNaN(removeArgs) || playlist.length < removeArgs) message.reply("Not a valid position.");
  if(removeArgs == "1") { playlist.shift(); playNextSong(); }
  playlist.splice(removeArgs - 1, 1);
}

function handlePlaying(message) {
  if (!connected) {
    handleConnection(message);
  }

  let playArgs = message.content.toString().slice(6);
  const filePath = path.resolve(wd, playArgs);
  if (!filePath.startsWith(starting_directory)) {
    message.reply("Access outside the base directory is not allowed.");
    return;
  }

  playlist.push(filePath);

  attemptToPlay();
}

function handleConnection(message) {
  // ensure that the user is in a channel before attempting to join it
  
}

function resetState() {
  if (connection && connection._state.status !== "destroyed")
    connection.destroy();
  player.stop();
  playlist = [];
  playing = false;
  connected = false;
  currentVoiceChannelId = null;
  currentTextChannelId = null;
}

function playNextSong() {
  if (playlist.length == 0 && playing) {
    resetState();
    return;
  }

  playing = true;

  try {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      playlist[0],
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "pipe:1",
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    player.play(resource);
    connection.subscribe(player);
  } catch {
    client.channels.cache
      .get(currentTextChannelId)
      .send("There was an error playing your song.");
    playlist.shift();

    playNextSong();
  }
}

function listCurrentDirectory(message) {
  console.log(`'${wd}'`);
  let listProcess = spawn("ls", [wd]);
  listProcess.stdout.on("data", (data) => {
    message.reply(
      data.toString() != ""
        ? "```" + data.toString().substring(0, 1990) + "\u2026" + "```"
        : "There are no files here."
    );
  });

  listProcess.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
    client.channels.cache
      .get(currentTextChannelId)
      .send("There was an error listing your directory. Try running -wd.");
  });
}

function changeDirectory(message) {
  let cdArgs = message.content.toString().slice(4).trim();
  const newPath = path.resolve(wd, cdArgs);

  if (!newPath.startsWith(starting_directory)) {
    message.reply("Access outside the base directory is not allowed.");
    return;
  }

  wd = newPath;
}

function displayQueue(message) {
  let index = 1;
  let replyMessage = "";
  playlist.forEach((element) => {
    replyMessage += `\n${index} - ${element}`;
    index++;
  });

  if(replyMessage == "") message.reply("There's nothing to play.");
  else replyInChunks(message, replyMessage);
}

function replyInChunks(message, text){
  let lines = text.split('\n');
  let currentMessage = "";
  for(i = 0; i < lines.length; i++){
    let newMessage = currentMessage + lines[i] + '\n';
    if(newMessage.length > 1990) {
      message.reply('```' + currentMessage + '```');
      currentMessage = lines[i] + '\n';
    }
    else(currentMessage = newMessage);
  }
  if(currentMessage !== "") message.reply('```' + currentMessage + '```');
}

function handleMassPlaying(message) {
  if (!connected) {
    handleConnection(message);
  }

  const listProcess = spawn("ls", [wd]);
  let dataBuffer = "";

  listProcess.stdout.on("data", (data) => {
    dataBuffer += data.toString();
  });

  listProcess.on("close", () => {
    const files = dataBuffer.split("\n").filter(isAudioFile);
    if (files.length === 0) {
      message.reply("There are no suitable files here.");
      return;
    }

    files.forEach((f) => playlist.push(path.join(wd, f)));
    attemptToPlay();
  });
}

function attemptToPlay() {
  if (connected && playlist.length > 0 && !playing) {
    playing = true;
    playNextSong();
  }
}
function isAudioFile(filePath) {
  // these are just the ones that i have/had in my music collection, add more as you see fit or if ffmpeg supports them
  const audioExtensions = [
    ".mp3",
    ".wav",
    ".ogg",
    ".flac",
    ".aac",
    ".m4a",
    ".webm",
    ".opus",
  ];
  const extension = filePath.toLowerCase().split(".").pop();
  return audioExtensions.includes(`.${extension}`);
}

