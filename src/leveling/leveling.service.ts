import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from '../database/schemas/user.schema';

@Injectable()
export class LevelingService {
  private readonly logger = new Logger(LevelingService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private configService: ConfigService,
  ) {}

  async getOrCreateUser(userId: string, guildId: string): Promise<User> {
    let user = await this.userModel.findOne({ userId, guildId });

    if (!user) {
      const baseDailyCap = this.configService.get<number>('leveling.baseDailyCap');
      user = await this.userModel.create({
        userId,
        guildId,
        level: 1,
        currentPoints: 0,
        totalPoints: 0,
        dailyPoints: 0,
        dailyCap: baseDailyCap,
        lastDailyReset: new Date(),
        inviteCodes: new Map(),
      });
    }

    return user;
  }

  calculateLevelRequirement(level: number): number {
    const baseRequirement = this.configService.get<number>('leveling.baseLevelRequirement') || 100;
    const multiplier = this.configService.get<number>('leveling.levelMultiplier') || 1.5;
    return Math.floor(baseRequirement * Math.pow(multiplier, level - 1));
  }

  calculateDailyCap(level: number): number {
    const baseCap = this.configService.get<number>('leveling.baseDailyCap') || 1000;
    const increasePerLevel = this.configService.get<number>('leveling.dailyCapIncreasePerLevel') || 100;
    return baseCap + (level - 1) * increasePerLevel;
  }

  async checkAndResetDaily(user: User): Promise<User> {
    const now = new Date();
    const lastReset = user.lastDailyReset || new Date(0);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      user.dailyPoints = 0;
      user.lastDailyReset = now;
      user.dailyCap = this.calculateDailyCap(user.level);
      await user.save();
      this.logger.log(`Reset daily points for user ${user.userId}`);
    }

    return user;
  }

  async addPoints(
    userId: string,
    guildId: string,
    points: number,
    reason: string,
  ): Promise<{ user: User; leveledUp: boolean; newLevel?: number }> {
    let user = await this.getOrCreateUser(userId, guildId);
    user = await this.checkAndResetDaily(user);

    if (user.dailyPoints >= user.dailyCap) {
      this.logger.debug(`User ${userId} has reached daily cap`);
      return { user, leveledUp: false };
    }

    const pointsToAdd = Math.min(points, user.dailyCap - user.dailyPoints);

    user.currentPoints += pointsToAdd;
    user.totalPoints += pointsToAdd;
    user.dailyPoints += pointsToAdd;

    let leveledUp = false;
    let newLevel: number | undefined;

    while (user.currentPoints >= this.calculateLevelRequirement(user.level)) {
      const requiredPoints = this.calculateLevelRequirement(user.level);
      user.currentPoints -= requiredPoints;
      user.level += 1;
      user.dailyCap = this.calculateDailyCap(user.level);
      leveledUp = true;
      newLevel = user.level;
      this.logger.log(`User ${userId} leveled up to level ${user.level}`);
    }

    await user.save();

    this.logger.debug(
      `Added ${pointsToAdd} points to user ${userId} for ${reason}. Total: ${user.totalPoints}, Current: ${user.currentPoints}, Level: ${user.level}`,
    );

    return { user, leveledUp, newLevel };
  }

  async getUserStats(userId: string, guildId: string) {
    let user = await this.getOrCreateUser(userId, guildId);
    user = await this.checkAndResetDaily(user);

    const nextLevelRequirement = this.calculateLevelRequirement(user.level);
    const remainingDailyCap = user.dailyCap - user.dailyPoints;

    return {
      level: user.level,
      currentPoints: user.currentPoints,
      totalPoints: user.totalPoints,
      dailyPoints: user.dailyPoints,
      dailyCap: user.dailyCap,
      remainingDailyCap,
      nextLevelRequirement,
      inviteCount: user.inviteCount,
    };
  }

  async incrementInviteCount(userId: string, guildId: string): Promise<User> {
    const user = await this.getOrCreateUser(userId, guildId);
    user.inviteCount += 1;
    await user.save();
    return user;
  }

  async setInviteCode(userId: string, guildId: string, code: string): Promise<void> {
    const user = await this.getOrCreateUser(userId, guildId);
    if (!user.inviteCodes) {
      user.inviteCodes = new Map();
    }
    user.inviteCodes.set(code, new Date().toISOString());
    await user.save();
  }

  async getInviteOwner(guildId: string, code: string): Promise<string | null> {
    const users = await this.userModel.find({ guildId });
    for (const user of users) {
      if (user.inviteCodes && user.inviteCodes.has(code)) {
        return user.userId;
      }
    }
    return null;
  }

  async getLeaderboard(guildId: string, limit: number = 10) {
    const users = await this.userModel
      .find({ guildId })
      .sort({ level: -1, currentPoints: -1, totalPoints: -1 })
      .limit(limit)
      .exec();

    return users.map((user, index) => ({
      rank: index + 1,
      userId: user.userId,
      level: user.level,
      currentPoints: user.currentPoints,
      totalPoints: user.totalPoints,
      inviteCount: user.inviteCount,
    }));
  }

  async getUserRank(userId: string, guildId: string): Promise<number> {
    const user = await this.getOrCreateUser(userId, guildId);

    const higherRankedCount = await this.userModel.countDocuments({
      guildId,
      $or: [
        { level: { $gt: user.level } },
        {
          level: user.level,
          currentPoints: { $gt: user.currentPoints }
        },
        {
          level: user.level,
          currentPoints: user.currentPoints,
          totalPoints: { $gt: user.totalPoints }
        }
      ]
    });

    return higherRankedCount + 1;
  }
}

