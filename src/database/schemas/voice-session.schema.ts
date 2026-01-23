import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class VoiceSession extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  guildId: string;

  @Prop({ required: true })
  channelId: string;

  @Prop({ required: true })
  joinedAt: Date;

  @Prop()
  leftAt?: Date;

  @Prop({ default: 0 })
  duration: number;
}

export const VoiceSessionSchema = SchemaFactory.createForClass(VoiceSession);

VoiceSessionSchema.index({ userId: 1, guildId: 1 });
VoiceSessionSchema.index({ guildId: 1, leftAt: 1 });
