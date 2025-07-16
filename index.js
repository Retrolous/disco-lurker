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
require("ffmpeg");

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

let playing = false;
let playlist = [];
let pwd = starting_directory;
let connection;
const player = createAudioPlayer();

// when the current song ends
player.on(AudioPlayerStatus.Idle, () => {
  playlist.shift();
  playNextSong();
});

// slash commands would probably be better but i'm still stuck in 2020
client.on("messageCreate", async (message) => {
  console.log("message received");

  // ignore own messages
  if (message.author.bot) return false;

  // join the author's channel
  if (message.content == "-join") {
    handleConnection(message);
  }

  // 
  if (message.content == "-list") {
    
  }

  if (message.content == "-pwd") {
    message.reply(pwd);
  }

  if (message.content == "-pause") {
    player.pause();
  }

  if (message.content == "-continue") {
    player.unpause();
  }

  if (message.content == "-skip") {
    playlist.shift();
    playNextSong();
  }

  if (message.content.startsWith("-cd")) {
    console.log(message.content);
    let cdArgs = message.content.toString().slice(4);
    pwd += "/" + cdArgs;
  }

  if (message.content == "-resetdir") {
    pwd = starting_directory;
  }

  if (message.content == "-queue") {
    message.reply("```\n" + playlist.join("\n") + "\n```");
  }

  if (message.content.startsWith("-play ")) {
    if (connection == undefined || connection._state.status == "destroyed") {
      message.reply("I'm not in a VC yet dingwad");
      return;
    }

    let playArgs = message.content.toString().slice(6);
    const filePath = pwd + "/" + playArgs;
    console.log("Path of file:" + filePath);
    playlist.push(filePath);

    if (!playing) {
      playing = true;
      playNextSong();
    }
  }
});

function handleConnection(message) {
  // ensure that the user is in a channel before attempting to join it
  if (message.member.voice.channel){
    // destroy any existing connection and player
      resetState();

    // join the author's channel
    connection = joinVoiceChannel({
    channelId: message.member.voice.channel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  })} else{
    message.reply("You need to be in a channel first.");
  };
}

function resetState(){
  if (connection) connection.destroy();
    player.stop()
    playlist = [];
    pwd = starting_directory;
    playing = false;
}

function playNextSong() {
  if (playlist.length == 0) {
    connection.destroy();
  }

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
}

function listCurrentDirectory(){
  console.log(`'${pwd}'`);
    let listProcess = spawn("ls", [pwd]);
    listProcess.stdout.on("data", (data) => {
      message.reply("```" + data.toString() + "```");
    });

    listProcess.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });
}