const { Client, Events, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, VoiceConnectionStatus } = require('@discordjs/voice');
const { token } = require('./config.json');
const { spawn } = require('child_process');
require ('ffmpeg');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates ] });

client.once(Events.ClientReady, readyClient => 
  {
	console.log(`${readyClient.user.tag}`);
  }
);

client.login(token);


let connection;
let resource;
const player = createAudioPlayer();

// slash commands would probably be better but i'm still stuck in 2020
client.on('messageCreate', (message) =>
  {
    console.log("message received");

    if (message.author.bot) return false;
    if (message.content.includes("@here") || message.content.includes("@everyone") || message.type == "REPLY") return false;

    if (message.mentions.has(client.user.id)) {
        handleConnection(message);
    }

    
    if(message.content == "-list"){
      let listProcess = spawn('ls')
      listProcess.stdout.on('data', (data) => {
      message.reply(data);
});
      
    }
  }
);

function handleConnection(message){
    if(message.member.voice.channel.id != null && (connection == undefined || connection._state.status == "destroyed")){
          console.log(`${message.member.voice.channel.id}`)

          connection = joinVoiceChannel({
          channelId: message.member.voice.channel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
          });
          connection.on(VoiceConnectionStatus.Ready, () => {
            const filePath = '/media/hdd/music/Foje/Foje - 1996 - 1982/01 - Skrisk.mp3';
            const ffmpeg = spawn('ffmpeg', [
              '-i', filePath,
              '-f', 's16le',
              '-ar', '48000',
              '-ac', '2',
              'pipe:1'
            ]);

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw
    });

    player.play(resource);
    connection.subscribe(player);

    player.on('error', error => {
      console.error(`Error: ${error.message}`);
    })
          }) 
       ;

        }
    else {
      connection.destroy();
    }
}

function listFiles(){

}