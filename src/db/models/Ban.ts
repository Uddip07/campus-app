import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { BanType } from "@/lib/types";

export interface IBan extends Document {
  userId: Types.ObjectId;
  type: BanType;
  reason: string;
  expiresAt?: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const BanSchema = new Schema<IBan>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Target user reference is required"],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ["mute", "temp_ban", "permanent_ban"],
        message: "{VALUE} is not a valid ban/restriction type",
      },
      required: [true, "Ban type is required"],
    },
    reason: {
      type: String,
      required: [true, "Ban reason is required"],
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator admin reference is required"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "bans",
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
BanSchema.index({ userId: 1, expiresAt: 1 });
BanSchema.index({ userId: 1, type: 1 });

export const Ban: Model<IBan> =
  mongoose.models.Ban || mongoose.model<IBan>("Ban", BanSchema);
