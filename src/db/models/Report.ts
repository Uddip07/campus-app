import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { ReportStatus } from "@/lib/types";

export interface IReport extends Document {
  messageId: Types.ObjectId;
  reporterId: Types.ObjectId;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  reviewedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: [true, "Reported message reference is required"],
      index: true,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter reference is required"],
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      enum: {
        values: [
          "Harassment",
          "Spam",
          "Threat",
          "Hate speech",
          "Impersonation",
          "Other",
        ],
        message: "{VALUE} is not an authorized violation reason",
      },
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "resolved", "dismissed"],
        message: "{VALUE} is not a valid report status",
      },
      default: "pending",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "reports",
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

// Prevent duplicate reports from the same user on the same message
ReportSchema.index({ messageId: 1, reporterId: 1 }, { unique: true });
// Index for staff moderation queue
ReportSchema.index({ status: 1, createdAt: -1 });

export const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);
