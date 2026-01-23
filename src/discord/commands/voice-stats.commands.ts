import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { EmbedBuilder, GuildMember } from 'discord.js';
import { VoiceStatsService } from '../../voice-stats/voice-stats.service';

@Injectable()
export class VoiceStatsCommands {
  constructor(private voiceStatsService: VoiceStatsService) { }

  @SlashCommand({
    name: 'voice-stats',
    description: 'Show top 5 users with longest time in your current voice channel',
  })
  async onVoiceStats(@Context() [interaction]: SlashCommandContext) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
      return interaction.reply({
        content: 'You must be in a voice channel to use this command!',
        ephemeral: true,
      });
    }

    const channelId = member.voice.channel.id;
    const channelName = member.voice.channel.name;

    const topUsers = await this.voiceStatsService.getTopVoiceUsersByChannel(guildId, channelId, 5);

    if (topUsers.length === 0) {
      return interaction.reply({
        content: `No voice activity recorded yet in **${channelName}**!`,
        ephemeral: true,
      });
    }

    const leaderboardText = await Promise.all(
      topUsers.map(async (entry, index) => {
        const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
        const username = user ? user.username : 'Unknown User';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        const duration = this.voiceStatsService.formatDuration(entry.totalDuration);
        return `${medal} **#${index + 1}** - ${username}\n` +
          `   ⏱️ ${duration} • ${entry.sessionCount} sessions`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`🎙️ Voice Stats: ${channelName}`)
      .setDescription(leaderboardText.join('\n\n'))
      .setTimestamp()
      .setFooter({ text: 'Stats for this voice channel only' });

    return interaction.reply({ embeds: [embed] });
  }
}
