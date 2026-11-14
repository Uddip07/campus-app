import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAnonymousIdentity extends Document {
  userId: Types.ObjectId;
  displayName: string;
  avatarSeed: string | null;
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnonymousIdentitySchema = new Schema<IAnonymousIdentity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    displayName: {
      type: String,
      required: [true, "Anonymous display name is required"],
      unique: true,
      trim: true,
    },
    avatarSeed: {
      type: String,
      default: null,
    },
    validFrom: {
      type: Date,
      default: Date.now,
      required: true,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    collection: "anonymousidentities",
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

// Indexes
AnonymousIdentitySchema.index({ userId: 1, createdAt: -1 });
AnonymousIdentitySchema.index({ displayName: 1 }, { unique: true });
AnonymousIdentitySchema.index({ validFrom: 1, validUntil: 1 });

export const AnonymousIdentity: Model<IAnonymousIdentity> =
  mongoose.models.AnonymousIdentity ||
  mongoose.model<IAnonymousIdentity>("AnonymousIdentity", AnonymousIdentitySchema);
