import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const ALLOWED_REACTIONS = ["like", "love", "laugh", "wow", "sad", "angry"] as const;
export type ReactionType = typeof ALLOWED_REACTIONS[number];

export interface IMessageReaction extends Document {
  messageId: Types.ObjectId;
  userId: Types.ObjectId;
  reaction: ReactionType;
  createdAt: Date;
}

const MessageReactionSchema = new Schema<IMessageReaction>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: [true, "Message reference is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    reaction: {
      type: String,
      enum: {
        values: ALLOWED_REACTIONS,
        message: "{VALUE} is not a valid reaction",
      },
      required: [true, "Reaction identifier is required"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "messagereactions",
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

// Compound unique constraint: a user can react with a specific emoji only once per message
MessageReactionSchema.index(
  { messageId: 1, userId: 1, reaction: 1 },
  { unique: true }
);

// Index for grouping and counting reactions on a message
MessageReactionSchema.index({ messageId: 1, reaction: 1 });

export const MessageReaction: Model<IMessageReaction> =
  mongoose.models.MessageReaction ||
  mongoose.model<IMessageReaction>("MessageReaction", MessageReactionSchema);
