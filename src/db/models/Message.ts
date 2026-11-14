import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { ModerationStatus } from "@/lib/types";

export interface IMessage extends Document {
  roomId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  replyToId?: Types.ObjectId | null;
  moderationStatus: ModerationStatus;
  deletedAt?: Date | null;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room reference is required"],
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender user reference is required"],
      index: true,
    },
    content: {
      type: String,
      required: [true, "Message content cannot be empty"],
      minlength: [1, "Message content cannot be empty"],
      maxlength: [4000, "Message exceeds 4000 character limit"],
      trim: true,
    },
    replyToId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "removed"],
        message: "{VALUE} is not a valid moderation status",
      },
      default: "approved",
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "messages",
    timestamps: true,
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

// High performance compound index for chronological cursor pagination
MessageSchema.index({ roomId: 1, createdAt: -1, _id: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ moderationStatus: 1, deletedAt: 1 });

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
