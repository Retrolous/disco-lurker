const { Client, SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
} = require("@discordjs/voice");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Makes the bot join the channel you are in."),
  async execute(interaction) {
    if (
      // if the person executing is in a voice channel, and it is not the channel that the bot is already in
      interaction.member.voice.channel && (!interaction.client.voice.channel || interaction.member.voice.channel.id != interaction.client.voice.channel.id)     
    )  {
      //#region Define resetState()
      function resetState() {
        // ensure a clean slate before attempting to join a different channel
        if (interaction.client.player.connection && interaction.client.player.connection._state.status !== "destroyed")
          interaction.client.player.connection.destroy();
        interaction.client.player.player.stop();
        interaction.client.player.playlist = [];
        interaction.client.player.playing = false;
        interaction.client.player.connected = false;
        interaction.client.player.workingVoiceChannelID = null;
        interaction.client.player.workingTextChannelID = null;
      }
      //#endregion

      // destroy any existing connection and player
      resetState();
      // join the author's channel
      interaction.client.player.workingVoiceChannelID = interaction.member.voice.channel.id;
      interaction.client.player.workingTextChannelID = interaction.channel.id;
      interaction.client.player.connection = joinVoiceChannel({
        channelId: interaction.member.voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
      interaction.client.player.connected = true;
      await interaction.reply({content: "HEEEELLOOOOO"});
    } else if (interaction.member.voice.channel && interaction.member.voice.channel.id == interaction.client.voice.channel.id) {
      await interaction.reply({content: "I can only join a channel I'm not currently in."});
    } else {
      await interaction.reply({content: "You need to be in a channel first." });
    }
  },
};
