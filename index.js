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
  try{
  playlist.shift();
  playNextSong();
} catch (error) {
  console.error(error);
}
});

// slash commands would probably be better but i'm still stuck in 2020
client.on("messageCreate", async (message) => {
  console.log("message received");

  // ignore own messages
  if (message.author.bot) return false;

  // join the author's channel
  if (message.content == "-join") {
    currentTextChannelId = message.channel.id;
    handleConnection(message);
  }

  if (message.content == "-leave") {
    currentTextChannelId = message.channel.id;
    resetState();
  }

  // 
  if (message.content == "-list") {
    currentTextChannelId = message.channel.id;
    listCurrentDirectory(message)
  }

  // output the current folder that the bot is in
  if (message.content == "-pwd") {
    currentTextChannelId = message.channel.id;
    message.reply(pwd);
  }

  if (message.content == "-pause") {
    currentTextChannelId = message.channel.id;
    player.pause();
  }

  // remove the current song from the queue (which will be the first) and play the next one
  if (message.content == "-skip") {
    currentTextChannelId = message.channel.id;
    playlist.shift();
    playNextSong();
  }

  // if a message starts with cd
  if (message.content.startsWith("-cd")) {
    currentTextChannelId = message.channel.id;
    changeDirectory(message);
  }

  if (message.content == "-resetdir") {
    currentTextChannelId = message.channel.id;
    pwd = starting_directory;
  }

  if (message.content == "-queue") {
    currentTextChannelId = message.channel.id;
    displayQueue(message);
  }

  if (message.content == "-clear") {
    currentTextChannelId = message.channel.id;
    playlist.splice(1);
  }

  if (message.content.startsWith("-play ")) {
    currentTextChannelId = message.channel.id;
    handlePlaying(message);
  }

  if (message.content == ("-playfolder")) {
    currentTextChannelId = message.channel.id;
    handleMassPlaying(message);
  }
});

function handlePlaying(message){
  if (!connection || connection._state.status === "destroyed") {
      handleConnection(message);
    }

    let playArgs = message.content.toString().slice(6);
    const filePath = pwd + "/" + playArgs;
    console.log("Path of file:" + filePath);
    playlist.push(filePath);

    attemptToPlay();
}
function handleConnection(message) {
  // ensure that the user is in a channel before attempting to join it
  if (message.member.voice.channel && message.member.voice.channel.id != currentVoiceChannelId){
    // destroy any existing connection and player
    resetState();
    // join the author's channel
    currentVoiceChannelId = message.member.voice.channel.id;
    currentTextChannelId = message.channel.id;
    connection = joinVoiceChannel({
    channelId: message.member.voice.channel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  })
  connected = true;
  } else if(message.member.voice.channel.id == currentVoiceChannelId){
  message.reply("Can only join a different channel");
  } 
  else{
    message.reply("You need to be in a channel first.");
  };
}

function resetState(){
  if (connection && connection._state.status !== "destroyed") connection.destroy();
    player.stop()
    playlist = [];
    playing = false;
    connected = false;
    currentVoiceChannelId = null;
    currentTextChannelId = null;
}



function playNextSong() {
  if (playlist.length == 0 && playing) {
    resetState();
  }

  try{
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

  player.on("error", (error) => {
    console.error(`Error: ${error.message}`);
  });
  } catch{
    client.channels.cache.get(currentTextChannelId).send('There was an error playing your song.');
    playlist.shift();


    playNextSong();
  }
}

function listCurrentDirectory(message){
  console.log(`'${pwd}'`);
    let listProcess = spawn("ls", [pwd]);
    listProcess.stdout.on("data", (data) => {
      message.reply(data.toString() != "" ? "```" + data.toString() + "```" : "There are no files here.");
    });

    listProcess.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
      client.channels.cache.get(currentTextChannelId).send('There was an error listing your directory. Try running -pwd.');
    });
}

function changeDirectory(message){
    console.log(message.content);
    let cdArgs = message.content.toString().slice(4);
    pwd += "/" + cdArgs;
}

function displayQueue(message){
    let index = 1;
    let replyMessage = "";
    playlist.forEach((element) => {
      replyMessage += `\n${index} - ${element}`;
      index++;
    })
    message.reply(replyMessage == "" ? "There's nothing to play." : "```" + replyMessage + "```");
}

function handleMassPlaying(message){
  if (!connection || connection._state.status === "destroyed") {
      handleConnection(message);
    }

  let fileList;
  let listProcess = spawn("ls", [pwd]);
    listProcess.stdout.on("data", (data) => {
      console.log(data.toString());
      console.log(data.toString().split("\n"));
      console.log(data.toString().split("\n").filter(isAudioFile));
      fileList = data.toString().split("\n").filter(isAudioFile);

      if (fileList.length == 0) message.reply("There are no suitable files here.")
      fileList.forEach((element) => playlist.push(pwd + `/` + element))

      attemptToPlay();
    });
}

function attemptToPlay(){
  if (connected && playlist.length > 0 && !playing) {
    playing = true;
    playNextSong();
  }
}
function isAudioFile(filePath) {
  // these are just the ones that i have/had in my music collection, add more as you see fit or if ffmpeg supports them
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.webm', '.opus'];
  const extension = filePath.toLowerCase().split('.').pop();
  return audioExtensions.includes(`.${extension}`);
}
