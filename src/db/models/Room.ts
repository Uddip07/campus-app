import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { RoomType } from "@/lib/types";

export interface IRoom extends Document {
  type: RoomType;
  name: string;
  cohortId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    type: {
      type: String,
      enum: {
        values: ["global", "cohort", "alumni"],
        message: "{VALUE} is not a valid room type",
      },
      required: [true, "Room type is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
    },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      default: null,
      index: true,
    },
  },
  {
    collection: "rooms",
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

// Pre-save validation ensuring cohortId is present for cohort rooms
RoomSchema.pre("save", function () {
  if (this.type === "cohort" && !this.cohortId) {
    throw new Error("cohortId is required for cohort rooms");
  }
});

// Indexes
RoomSchema.index(
  { type: 1, cohortId: 1 },
  { unique: true, partialFilterExpression: { type: "cohort" } }
);
RoomSchema.index({ type: 1 });

export const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>("Room", RoomSchema);
