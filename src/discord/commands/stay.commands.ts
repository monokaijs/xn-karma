import { Injectable, Logger } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { GuildMember, EmbedBuilder } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';

@Injectable()
export class StayCommands {
  private readonly logger = new Logger(StayCommands.name);
  private connections = new Map<string, VoiceConnection>();

  @SlashCommand({
    name: 'stay',
    description: 'Bot joins your voice channel and stays to keep the temp channel alive',
  })
  async onStay(@Context() [interaction]: SlashCommandContext) {
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
      return interaction.reply({
        content: 'You must be in a voice channel to use this command!',
        ephemeral: true,
      });
    }

    const voiceChannel = member.voice.channel;
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    // Check if already connected to this channel
    const existingConnection = this.connections.get(guildId);
    if (existingConnection && existingConnection.joinConfig.channelId === voiceChannel.id) {
      return interaction.reply({
        content: 'I am already staying in this channel!',
        ephemeral: true,
      });
    }

    // Disconnect from previous channel if connected to a different one
    if (existingConnection) {
      existingConnection.destroy();
      this.connections.delete(guildId);
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true,
      });

      // Wait for the connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      this.connections.set(guildId, connection);

      // Handle disconnection
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          // Try to reconnect
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          // If reconnection fails, clean up
          connection.destroy();
          this.connections.delete(guildId);
          this.logger.log(`Disconnected from voice channel in guild ${guildId}`);
        }
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        this.connections.delete(guildId);
      });

      this.logger.log(`Joined voice channel ${voiceChannel.name} in guild ${guildId}`);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔊 Staying in Voice Channel')
        .setDescription(`I have joined **${voiceChannel.name}** and will stay to keep the channel alive.`)
        .addFields({
          name: 'To make me leave',
          value: 'Use `/leave` command',
          inline: false,
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      this.logger.error(`Failed to join voice channel: ${error.message}`, error.stack);
      return interaction.reply({
        content: 'Failed to join the voice channel. Please try again.',
        ephemeral: true,
      });
    }
  }

  @SlashCommand({
    name: 'leave',
    description: 'Bot leaves the voice channel',
  })
  async onLeave(@Context() [interaction]: SlashCommandContext) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    const connection = this.connections.get(guildId);

    if (!connection) {
      return interaction.reply({
        content: 'I am not in any voice channel!',
        ephemeral: true,
      });
    }

    connection.destroy();
    this.connections.delete(guildId);

    this.logger.log(`Left voice channel in guild ${guildId}`);

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('👋 Left Voice Channel')
      .setDescription('I have left the voice channel.')
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}

