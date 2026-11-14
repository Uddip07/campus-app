import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAnnouncementAttachment extends Document {
  announcementId: Types.ObjectId;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
}

const AnnouncementAttachmentSchema = new Schema<IAnnouncementAttachment>(
  {
    announcementId: {
      type: Schema.Types.ObjectId,
      ref: "Announcement",
      required: [true, "Announcement reference is required"],
      index: true,
    },
    storagePath: {
      type: String,
      required: [true, "Storage path is required"],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be positive"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "announcementattachments",
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

AnnouncementAttachmentSchema.index({ announcementId: 1 });

export const AnnouncementAttachment: Model<IAnnouncementAttachment> =
  mongoose.models.AnnouncementAttachment ||
  mongoose.model<IAnnouncementAttachment>(
    "AnnouncementAttachment",
    AnnouncementAttachmentSchema
  );
