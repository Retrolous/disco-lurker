const { Client, Events, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { token, starting_directory } = require("./config.json");
const { spawn } = require("child_process");
const path = require("path");

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag}`);
});

client.login(token);

let connected = false;
let playing = false;
let currentTextChannelId;
let currentVoiceChannelId;
let playlist = [];
let pwd = starting_directory;
let connection;

const player = createAudioPlayer();

// when the current song ends
player.on(AudioPlayerStatus.Idle, () => {
  try {
    playlist.shift();
    playNextSong();
  } catch (error) {
    console.error(error);
  }
});

player.on("error", (error) => {
  console.error(`Error: ${error.message}`);
});

// slash commands would probably be better but i'm still stuck in 2020

client.on("messageCreate", async (message) => {
  console.log("message received");

  // ignore own messages
  if (message.author.bot) return false;

  currentTextChannelId = message.channel.id;

  switch (message.content) {
    case "-leave":
      resetState();
      break;
    case "-ls":
      listCurrentDirectory(message);
      break;
    case "-pwd": //output the current working directory
      message.reply(pwd);
      break;
    case "-resetdir":
      pwd = starting_directory;
      break;
    case "-queue":
      displayQueue(message);
      break;
    case "-clear":
      playlist.splice(1);
      break;
    case "-playfolder":
      handleMassPlaying(message);
      break;
    case "-pause":
      player.pause();
      break;
    case "-skip": // remove the current song from the queue (which will be the first) and play the next one
      playlist.shift();
      playNextSong();
      break;
  }

  if (message.content.startsWith("-cd")) {
    changeDirectory(message);
  }

  if (message.content.startsWith("-play ")) {
    handlePlaying(message);
  }

  if (message.content.startsWith("-seek ")) {
    handleSeeking(message);
  }

  if(message.content.startsWith("-remove ")){
    handleRemoving(message);
  }
});

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
  const filePath = path.resolve(pwd, playArgs);
  if (!filePath.startsWith(starting_directory)) {
    message.reply("Access outside the base directory is not allowed.");
    return;
  }

  playlist.push(filePath);

  attemptToPlay();
}

function handleConnection(message) {
  // ensure that the user is in a channel before attempting to join it
  if (
    message.member.voice.channel &&
    message.member.voice.channel.id != currentVoiceChannelId
  ) {
    // destroy any existing connection and player
    resetState();
    // join the author's channel
    currentVoiceChannelId = message.member.voice.channel.id;
    currentTextChannelId = message.channel.id;
    connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    connected = true;
  } else if (message.member.voice.channel.id == currentVoiceChannelId) {
    message.reply("Can only join a different channel");
  } else {
    message.reply("You need to be in a channel first.");
  }
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
  console.log(`'${pwd}'`);
  let listProcess = spawn("ls", [pwd]);
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
      .send("There was an error listing your directory. Try running -pwd.");
  });
}

function changeDirectory(message) {
  let cdArgs = message.content.toString().slice(4).trim();
  const newPath = path.resolve(pwd, cdArgs);

  if (!newPath.startsWith(starting_directory)) {
    message.reply("Access outside the base directory is not allowed.");
    return;
  }

  pwd = newPath;
}

function displayQueue(message) {
  let index = 1;
  let replyMessage = "";
  playlist.forEach((element) => {
    replyMessage += `\n${index} - ${element}`;
    index++;
  });
  message.reply(
    replyMessage == ""
      ? "There's nothing to play."
      : "```" + replyMessage.substring(0, 1990) + "```"
  );
}

function handleMassPlaying(message) {
  if (!connected) {
    handleConnection(message);
  }

  const listProcess = spawn("ls", [pwd]);
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

    files.forEach((f) => playlist.push(path.join(pwd, f)));
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
