import { Injectable, Logger } from '@nestjs/common';
import { On } from 'necord';
import { Message, ChannelType } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { LevelingService } from '../../leveling/leveling.service';

@Injectable()
export class MessageListener {
  private readonly logger = new Logger(MessageListener.name);

  constructor(
    private levelingService: LevelingService,
    private configService: ConfigService,
  ) {}

  @On('messageCreate')
  async onMessage([message]: [Message]) {
    console.log('got new message', message.author, message.guild, message.channel);
    try {
      if (!message.author || message.author.bot) return;
      if (!message.guild) return;
      if (message.channel.isDMBased()) return;
      if (message.channel.name?.toLowerCase().includes('spam')) return;

      const userId = message.author.id;
      const guildId = message.guild.id;

      this.logger.debug(`Processing message from ${message.author.tag} in ${message.channel.name}`);

      const user = await this.levelingService.getOrCreateUser(userId, guildId);
      const cooldown = this.configService.get<number>('points.messageCooldown') || 60;
      const now = new Date();

      if (user.lastMessageTime) {
        const secondsSinceLastMessage =
          (now.getTime() - user.lastMessageTime.getTime()) / 1000;
        if (secondsSinceLastMessage < cooldown) {
          this.logger.debug(`User ${userId} on cooldown (${secondsSinceLastMessage.toFixed(1)}s / ${cooldown}s)`);
          return;
        }
      }

      user.lastMessageTime = now;
      await user.save();

      const messagePoints = this.configService.get<number>('points.message') || 10;
      const result = await this.levelingService.addPoints(
        userId,
        guildId,
        messagePoints,
        'message',
      );

      const requiredPoints = await this.levelingService.calculateLevelRequirement(result.user.level);
      this.logger.log(`Awarded ${messagePoints} points to ${message.author.tag}. Level ${result.user.level}: ${result.user.currentPoints}/${requiredPoints}`);

      if (result.leveledUp) {
        await message.channel.send(
          `🎉 Congratulations <@${userId}>! You've reached level **${result.newLevel}**!`,
        );
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`, error.stack);
    }
  }
}

