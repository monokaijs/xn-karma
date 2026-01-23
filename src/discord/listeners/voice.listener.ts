import { Injectable, Logger } from '@nestjs/common';
import { On, Once } from 'necord';
import { Client, VoiceState, ChannelType } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { LevelingService } from '../../leveling/leveling.service';
import { VoiceStatsService } from '../../voice-stats/voice-stats.service';

@Injectable()
export class VoiceListener {
  private readonly logger = new Logger(VoiceListener.name);

  constructor(
    private levelingService: LevelingService,
    private configService: ConfigService,
    private voiceStatsService: VoiceStatsService,
    private client: Client,
  ) { }

  @Once('ready')
  async onReady() {
    this.logger.log('Bot ready, scanning existing voice channel members...');

    try {
      for (const guild of this.client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
          if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
            continue;
          }

          const voiceChannel = channel;
          for (const [memberId, member] of voiceChannel.members) {
            if (member.user.bot) continue;

            const hasActiveSession = await this.voiceStatsService.hasActiveSession(memberId, guild.id);
            if (!hasActiveSession) {
              await this.voiceStatsService.recordJoin(memberId, guild.id, channel.id);
              this.logger.debug(`Recorded existing voice member ${memberId} in channel ${channel.name}`);
            }
          }
        }
      }

      this.logger.log('Finished scanning existing voice channel members');
    } catch (error) {
      this.logger.error(`Error scanning voice channels on startup: ${error.message}`, error.stack);
    }
  }

  @On('voiceStateUpdate')
  async onVoiceStateUpdate([oldState, newState]: [VoiceState, VoiceState]) {
    try {
      if (!newState.member || newState.member.user.bot) return;
      if (!newState.guild) return;

      const userId = newState.member.id;
      const guildId = newState.guild.id;

      if (!oldState.channel && newState.channel) {
        await this.handleVoiceJoin(userId, guildId, newState.channel.id);
      } else if (oldState.channel && !newState.channel) {
        await this.handleVoiceLeave(userId, guildId);
      }
    } catch (error) {
      this.logger.error(`Error processing voice state update: ${error.message}`, error.stack);
    }
  }

  private async handleVoiceJoin(userId: string, guildId: string, channelId: string) {
    try {
      const user = await this.levelingService.getOrCreateUser(userId, guildId);
      user.voiceJoinTime = new Date();
      await user.save();

      await this.voiceStatsService.recordJoin(userId, guildId, channelId);

      this.logger.debug(`User ${userId} joined voice channel ${channelId}`);
    } catch (error) {
      this.logger.error(`Error handling voice join for user ${userId}: ${error.message}`, error.stack);
    }
  }

  private async handleVoiceLeave(userId: string, guildId: string) {
    try {
      const user = await this.levelingService.getOrCreateUser(userId, guildId);

      if (user.voiceJoinTime) {
        const now = new Date();
        const minutesInVoice = Math.floor(
          (now.getTime() - user.voiceJoinTime.getTime()) / (1000 * 60),
        );

        if (minutesInVoice > 0) {
          const pointsPerMinute = this.configService.get<number>('points.voicePerMinute') || 5;
          const totalPoints = minutesInVoice * pointsPerMinute;

          const result = await this.levelingService.addPoints(
            userId,
            guildId,
            totalPoints,
            'voice',
          );

          this.logger.debug(
            `User ${userId} earned ${totalPoints} points for ${minutesInVoice} minutes in voice`,
          );

          if (result.leveledUp) {
            this.logger.log(`User ${userId} leveled up to ${result.newLevel} from voice activity`);
          }
        }

        user.voiceJoinTime = undefined;
        await user.save();
      }

      await this.voiceStatsService.recordLeave(userId, guildId);
    } catch (error) {
      this.logger.error(`Error handling voice leave for user ${userId}: ${error.message}`, error.stack);
    }
  }
}
