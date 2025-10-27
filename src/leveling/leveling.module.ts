import { Module } from '@nestjs/common';
import { LevelingService } from './leveling.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [LevelingService],
  exports: [LevelingService],
})
export class LevelingModule {}

