import { Module } from '@nestjs/common';
import { NecordModule } from 'necord';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';
import { LevelingModule } from '../leveling/leveling.module';
import { VoiceStatsModule } from '../voice-stats/voice-stats.module';
import { MessageListener } from './listeners/message.listener';
import { VoiceListener } from './listeners/voice.listener';
import { InviteListener } from './listeners/invite.listener';
import { StatsCommands } from './commands/stats.commands';
import { StayCommands } from './commands/stay.commands';
import { VoiceStatsCommands } from './commands/voice-stats.commands';

@Module({
  imports: [
    NecordModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        token: configService.get<string>('discord.token') || '',
        intents: [
          IntentsBitField.Flags.Guilds,
          IntentsBitField.Flags.GuildMessages,
          IntentsBitField.Flags.MessageContent,
          IntentsBitField.Flags.GuildVoiceStates,
          IntentsBitField.Flags.GuildInvites,
          IntentsBitField.Flags.GuildMembers,
        ],
        development: [],
      }),
      inject: [ConfigService],
    }),
    LevelingModule,
    VoiceStatsModule,
  ],
  providers: [MessageListener, VoiceListener, InviteListener, StatsCommands, StayCommands, VoiceStatsCommands],
})
export class DiscordModule { }


