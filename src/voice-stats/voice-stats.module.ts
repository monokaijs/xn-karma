import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VoiceSession, VoiceSessionSchema } from '../database/schemas/voice-session.schema';
import { VoiceStatsService } from './voice-stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VoiceSession.name, schema: VoiceSessionSchema }]),
  ],
  providers: [VoiceStatsService],
  exports: [VoiceStatsService, MongooseModule],
})
export class VoiceStatsModule { }
