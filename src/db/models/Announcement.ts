import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { AnnouncementAudience } from "@/lib/types";

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  authorId: Types.ObjectId;
  audienceType: AnnouncementAudience;
  cohortId?: Types.ObjectId | null;
  isPinned: boolean;
  publishedAt: Date;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      minlength: [1, "Title cannot be empty"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Announcement content is required"],
      trim: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author user reference is required"],
    },
    audienceType: {
      type: String,
      enum: {
        values: ["all", "cohort", "alumni"],
        message: "{VALUE} is not a valid audience type",
      },
      required: [true, "Audience type is required"],
      index: true,
    },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      default: null,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    collection: "announcements",
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

// Pre-save validation ensuring cohortId is present for cohort audience
AnnouncementSchema.pre("save", function () {
  if (this.audienceType === "cohort" && !this.cohortId) {
    throw new Error("cohortId is required when audienceType is 'cohort'");
  }
});

// Compound index for audience targeting and chronological feeds
AnnouncementSchema.index({
  audienceType: 1,
  cohortId: 1,
  publishedAt: -1,
});

AnnouncementSchema.index({ isPinned: -1, publishedAt: -1 });

export const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
