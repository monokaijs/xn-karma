import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext, Options } from 'necord';
import { EmbedBuilder, User, AttachmentBuilder } from 'discord.js';
import { LevelingService } from '../../leveling/leveling.service';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import * as path from 'path';
import * as fs from 'fs';

class StatsDto {
  user?: User;
}

@Injectable()
export class StatsCommands {
  constructor(private levelingService: LevelingService) {}

  @SlashCommand({
    name: 'stats',
    description: 'Check your or another user\'s level and points',
  })
  async onStats(
    @Context() [interaction]: SlashCommandContext,
    @Options() dto: StatsDto,
  ) {
    const targetUser = dto.user || interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    const stats = await this.levelingService.getUserStats(targetUser.id, guildId);

    const progressPercentage = (
      (stats.currentPoints / stats.nextLevelRequirement) *
      100
    ).toFixed(1);

    const progressBar = this.createProgressBar(
      stats.currentPoints,
      stats.nextLevelRequirement,
    );

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`📊 Stats for ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: '🎯 Level',
          value: `**${stats.level}**`,
          inline: true,
        },
        {
          name: '⭐ Current Points',
          value: `**${stats.currentPoints}** / ${stats.nextLevelRequirement}`,
          inline: true,
        },
        {
          name: '🏆 Total Points',
          value: `**${stats.totalPoints}**`,
          inline: true,
        },
        {
          name: '📅 Daily Progress',
          value: `**${stats.dailyPoints}** / ${stats.dailyCap}`,
          inline: true,
        },
        {
          name: '⏳ Remaining Daily Cap',
          value: `**${stats.remainingDailyCap}**`,
          inline: true,
        },
        {
          name: '👥 Invites',
          value: `**${stats.inviteCount}**`,
          inline: true,
        },
        {
          name: 'Progress to Next Level',
          value: `${progressBar} ${progressPercentage}%`,
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({ text: 'Keep earning points to level up!' });

    return interaction.reply({ embeds: [embed] });
  }

  @SlashCommand({
    name: 'rank',
    description: 'Check your rank on the leaderboard',
  })
  async onRank(@Context() [interaction]: SlashCommandContext) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    const userId = interaction.user.id;
    const userStats = await this.levelingService.getUserStats(userId, guildId);
    const userRank = await this.levelingService.getUserRank(userId, guildId);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🏆 Your Rank`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: '📊 Rank',
          value: `**#${userRank}**`,
          inline: true,
        },
        {
          name: '🎯 Level',
          value: `**${userStats.level}**`,
          inline: true,
        },
        {
          name: '🏆 Total Points',
          value: `**${userStats.totalPoints}**`,
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({ text: 'Use /leaderboard to see top players!' });

    return interaction.reply({ embeds: [embed] });
  }

  @SlashCommand({
    name: 'leaderboard',
    description: 'View the server leaderboard',
  })
  async onLeaderboard(@Context() [interaction]: SlashCommandContext) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    const leaderboard = await this.levelingService.getLeaderboard(guildId, 10);

    if (leaderboard.length === 0) {
      return interaction.reply({
        content: 'No users found on the leaderboard yet!',
        ephemeral: true,
      });
    }

    const leaderboardText = await Promise.all(
      leaderboard.map(async (entry) => {
        const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
        const username = user ? user.username : 'Unknown User';
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '🏅';
        return `${medal} **#${entry.rank}** - ${username}\n` +
               `   Level ${entry.level} • ${entry.totalPoints} total points • ${entry.inviteCount} invites`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Server Leaderboard')
      .setDescription(leaderboardText.join('\n\n'))
      .setTimestamp()
      .setFooter({ text: 'Keep earning points to climb the ranks!' });

    return interaction.reply({ embeds: [embed] });
  }

  @SlashCommand({
    name: 'png',
    description: 'Generate top 3 leaderboard image',
  })
  async onPng(@Context() [interaction]: SlashCommandContext) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server!',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const leaderboard = await this.levelingService.getLeaderboard(guildId, 3);

      if (leaderboard.length === 0) {
        return interaction.editReply({
          content: 'No users found on the leaderboard yet!',
        });
      }

      const canvas = createCanvas(960, 540);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 960, 540);

      const positions = [
        { x: 398, y: 215, width: 140, height: 170 },
        { x: 672, y: 274, width: 100, height: 120 },
        { x: 197, y: 300, width: 90, height: 100 },
      ];

      for (let i = 0; i < Math.min(leaderboard.length, 3); i++) {
        const entry = leaderboard[i];
        const user = await interaction.client.users.fetch(entry.userId).catch(() => null);

        if (user) {
          const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
          const avatar = await loadImage(avatarURL);

          const pos = positions[i];

          this.drawResizedAndCroppedAvatar(ctx, avatar, pos.x, pos.y, pos.width, pos.height);
        }
      }

      const framePath = path.join(process.cwd(), 'src', 'assets', 'frame-01.png');
      const frame = await loadImage(framePath);
      ctx.drawImage(frame, 0, 0, 960, 540);

      const buffer = canvas.toBuffer('image/jpeg', 90);
      const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.jpg' });

      return interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      console.error('Error generating image:', error);
      return interaction.editReply({
        content: 'An error occurred while generating the image.',
      });
    }
  }

  private drawResizedAndCroppedAvatar(
    ctx: any,
    image: Image,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const imgWidth = image.width;
    const imgHeight = image.height;
    const targetRatio = width / height;
    const imgRatio = imgWidth / imgHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = imgWidth;
    let sourceHeight = imgHeight;

    if (imgRatio > targetRatio) {
      sourceWidth = imgHeight * targetRatio;
      sourceX = (imgWidth - sourceWidth) / 2;
    } else {
      sourceHeight = imgWidth / targetRatio;
      sourceY = (imgHeight - sourceHeight) / 2;
    }

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height,
    );
  }

  private createProgressBar(current: number, max: number, length: number = 20): string {
    const percentage = Math.min(current / max, 1);
    const filled = Math.round(length * percentage);
    const empty = length - filled;

    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);

    return `${filledBar}${emptyBar}`;
  }
}

