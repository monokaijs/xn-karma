import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VoiceSession } from '../database/schemas/voice-session.schema';

@Injectable()
export class VoiceStatsService {
  private readonly logger = new Logger(VoiceStatsService.name);

  constructor(
    @InjectModel(VoiceSession.name) private voiceSessionModel: Model<VoiceSession>,
  ) { }

  async recordJoin(userId: string, guildId: string, channelId: string): Promise<VoiceSession> {
    const session = await this.voiceSessionModel.create({
      userId,
      guildId,
      channelId,
      joinedAt: new Date(),
    });
    this.logger.debug(`Recorded voice join for user ${userId} in channel ${channelId}`);
    return session;
  }

  async recordLeave(userId: string, guildId: string): Promise<VoiceSession | null> {
    const session = await this.voiceSessionModel.findOne({
      userId,
      guildId,
      leftAt: { $exists: false },
    }).sort({ joinedAt: -1 });

    if (!session) {
      this.logger.warn(`No active voice session found for user ${userId}`);
      return null;
    }

    const now = new Date();
    const duration = Math.floor((now.getTime() - session.joinedAt.getTime()) / 1000);

    session.leftAt = now;
    session.duration = duration;
    await session.save();

    this.logger.debug(`Recorded voice leave for user ${userId}, duration: ${duration}s`);
    return session;
  }

  async getTopVoiceUsers(guildId: string, limit: number = 5): Promise<Array<{
    userId: string;
    totalDuration: number;
    sessionCount: number;
  }>> {
    const result = await this.voiceSessionModel.aggregate([
      {
        $match: {
          guildId,
          leftAt: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalDuration: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          userId: '$_id',
          totalDuration: 1,
          sessionCount: 1,
          _id: 0,
        },
      },
    ]);

    return result;
  }

  async getUserVoiceStats(userId: string, guildId: string): Promise<{
    totalDuration: number;
    sessionCount: number;
    longestSession: number;
    averageSession: number;
  }> {
    const sessions = await this.voiceSessionModel.find({
      userId,
      guildId,
      leftAt: { $exists: true },
    });

    if (sessions.length === 0) {
      return {
        totalDuration: 0,
        sessionCount: 0,
        longestSession: 0,
        averageSession: 0,
      };
    }

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const longestSession = Math.max(...sessions.map(s => s.duration));

    return {
      totalDuration,
      sessionCount: sessions.length,
      longestSession,
      averageSession: Math.floor(totalDuration / sessions.length),
    };
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}
