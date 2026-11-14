import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface INotificationDevice extends Document {
  userId: Types.ObjectId;
  pushToken: string;
  platform: "web" | "ios" | "android";
  createdAt: Date;
  lastSeenAt: Date;
}

const NotificationDeviceSchema = new Schema<INotificationDevice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    pushToken: {
      type: String,
      required: [true, "Push token is required"],
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: {
        values: ["web", "ios", "android"],
        message: "{VALUE} is not an authorized device platform",
      },
      required: true,
      default: "web",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: "notificationdevices",
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
NotificationDeviceSchema.index({ pushToken: 1 }, { unique: true });
NotificationDeviceSchema.index({ userId: 1, lastSeenAt: -1 });

export const NotificationDevice: Model<INotificationDevice> =
  mongoose.models.NotificationDevice ||
  mongoose.model<INotificationDevice>("NotificationDevice", NotificationDeviceSchema);
