import { Injectable, Logger } from '@nestjs/common';
import { On, Once } from 'necord';
import { Client, GuildMember, Invite, Collection } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { LevelingService } from '../../leveling/leveling.service';

@Injectable()
export class InviteListener {
  private readonly logger = new Logger(InviteListener.name);
  private invites: Map<string, Collection<string, Invite>> = new Map();

  constructor(
    private levelingService: LevelingService,
    private configService: ConfigService,
    private client: Client,
  ) {}

  @Once('ready')
  async onReady() {
    this.logger.log('Caching invites for all guilds...');
    for (const guild of this.client.guilds.cache.values()) {
      try {
        const invites = await guild.invites.fetch();
        this.invites.set(guild.id, invites);

        for (const invite of invites.values()) {
          if (invite.inviter) {
            await this.levelingService.setInviteCode(
              invite.inviter.id,
              guild.id,
              invite.code,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Failed to fetch invites for guild ${guild.id}:`, error);
      }
    }
    this.logger.log('Invite caching complete');
  }

  @On('inviteCreate')
  async onInviteCreate([invite]: [Invite]) {
    try {
      if (!invite.guild) return;

      const guildInvites = this.invites.get(invite.guild.id);
      if (guildInvites) {
        guildInvites.set(invite.code, invite);
      }

      if (invite.inviter) {
        await this.levelingService.setInviteCode(
          invite.inviter.id,
          invite.guild.id,
          invite.code,
        );
        this.logger.debug(`Invite ${invite.code} created by ${invite.inviter.id}`);
      }
    } catch (error) {
      this.logger.error(`Error handling invite create: ${error.message}`, error.stack);
    }
  }

  @On('inviteDelete')
  async onInviteDelete([invite]: [Invite]) {
    try {
      if (!invite.guild) return;

      const guildInvites = this.invites.get(invite.guild.id);
      if (guildInvites) {
        guildInvites.delete(invite.code);
      }
    } catch (error) {
      this.logger.error(`Error handling invite delete: ${error.message}`, error.stack);
    }
  }

  @On('guildMemberAdd')
  async onGuildMemberAdd([member]: [GuildMember]) {
    if (member.user.bot) return;

    try {
      const newInvites = await member.guild.invites.fetch();
      const oldInvites = this.invites.get(member.guild.id);

      if (!oldInvites) {
        this.invites.set(member.guild.id, newInvites);
        return;
      }

      const usedInvite = newInvites.find((inv) => {
        const oldInv = oldInvites.get(inv.code);
        return oldInv && inv.uses !== null && oldInv.uses !== null && inv.uses > oldInv.uses;
      });

      if (usedInvite && usedInvite.inviter) {
        const inviterId = usedInvite.inviter.id;
        const invitePoints = this.configService.get<number>('points.invite') || 50;

        const result = await this.levelingService.addPoints(
          inviterId,
          member.guild.id,
          invitePoints,
          'invite',
        );

        await this.levelingService.incrementInviteCount(inviterId, member.guild.id);

        this.logger.log(
          `User ${inviterId} earned ${invitePoints} points for inviting ${member.user.tag}`,
        );

        if (result.leveledUp) {
          const systemChannel = member.guild.systemChannel;
          if (systemChannel) {
            await systemChannel.send(
              `🎉 Congratulations <@${inviterId}>! You've reached level **${result.newLevel}** by inviting new members!`,
            );
          }
        }
      }

      this.invites.set(member.guild.id, newInvites);
    } catch (error) {
      this.logger.error(`Failed to process invite for member ${member.user.tag}:`, error);
    }
  }
}

