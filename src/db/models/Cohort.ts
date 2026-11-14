import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICohort extends Document {
  graduationYear: number;
  createdAt: Date;
  updatedAt: Date;
}

const CohortSchema = new Schema<ICohort>(
  {
    graduationYear: {
      type: Number,
      required: [true, "Graduation year is required"],
      unique: true,
      min: [2000, "Graduation year must be >= 2000"],
      max: [2100, "Graduation year must be <= 2100"],
    },
  },
  {
    collection: "cohorts",
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

// Explicit index for graduation year lookups
CohortSchema.index({ graduationYear: 1 }, { unique: true });

export const Cohort: Model<ICohort> =
  mongoose.models.Cohort || mongoose.model<ICohort>("Cohort", CohortSchema);
