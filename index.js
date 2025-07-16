const { Client, Events, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer } = require('@discordjs/voice');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, readyClient => 
  {
	console.log(`${readyClient.user.tag}`);
  }
);

client.login(token);


let connection;
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
        }
    else {
      connection.destroy();
    }
}
