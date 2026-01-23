import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { EmbedBuilder } from 'discord.js';
import { VoiceStatsService } from '../../voice-stats/voice-stats.service';

@Injectable()
export class VoiceStatsCommands {
  constructor(private voiceStatsService: VoiceStatsService) { }

  @SlashCommand({
    name: 'voice-stats',
    description: 'Show top 5 users with longest voice channel time',
  })
  async onVoiceStats(@Context() [interaction]: SlashCommandContext) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    const topUsers = await this.voiceStatsService.getTopVoiceUsers(guildId, 5);

    if (topUsers.length === 0) {
      return interaction.reply({
        content: 'No voice activity recorded yet!',
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
      .setTitle('🎙️ Voice Channel Leaderboard')
      .setDescription(leaderboardText.join('\n\n'))
      .setTimestamp()
      .setFooter({ text: 'Join voice channels to climb the ranks!' });

    return interaction.reply({ embeds: [embed] });
  }
}
