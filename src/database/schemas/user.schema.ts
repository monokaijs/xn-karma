import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true })
  guildId: string;

  @Prop({ default: 1 })
  level: number;

  @Prop({ default: 0 })
  currentPoints: number;

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ default: 0 })
  dailyPoints: number;

  @Prop({ default: 1000 })
  dailyCap: number;

  @Prop()
  lastDailyReset: Date;

  @Prop()
  lastMessageTime?: Date;

  @Prop()
  voiceJoinTime?: Date;

  @Prop({ default: 0 })
  inviteCount: number;

  @Prop({ type: Map, of: String })
  inviteCodes: Map<string, string>;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ userId: 1, guildId: 1 }, { unique: true });

