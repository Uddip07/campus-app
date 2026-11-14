import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { UserRole, UserStatus } from "@/lib/types";

export interface IUser extends Document {
  authId?: string | null;
  collegeId: string;
  collegeEmail: string;
  enrollmentYear: number;
  programCode: string;
  rollNumber: string;
  cohortId: Types.ObjectId;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    authId: {
      type: String,
      sparse: true,
      index: true,
      trim: true,
    },
    collegeId: {
      type: String,
      required: [true, "College ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    collegeEmail: {
      type: String,
      required: [true, "Institutional email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/@nsut\.ac\.in$/, "Email must be a valid @nsut.ac.in institutional address"],
    },
    enrollmentYear: {
      type: Number,
      required: [true, "Enrollment year is required"],
      min: [2000, "Enrollment year must be >= 2000"],
      max: [2100, "Enrollment year must be <= 2100"],
    },
    programCode: {
      type: String,
      required: [true, "Program code is required"],
      trim: true,
      uppercase: true,
    },
    rollNumber: {
      type: String,
      required: [true, "Roll number is required"],
      trim: true,
    },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: [true, "Cohort reference is required"],
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: ["student", "alumni", "moderator", "admin", "super_admin"],
        message: "{VALUE} is not a valid user role",
      },
      default: "student",
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "suspended", "banned"],
        message: "{VALUE} is not a valid user status",
      },
      default: "active",
      required: true,
    },
  },
  {
    collection: "users",
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

// Indexes for fast lookups
UserSchema.index({ collegeEmail: 1 }, { unique: true });
UserSchema.index({ collegeId: 1 }, { unique: true });
UserSchema.index({ cohortId: 1 });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ authId: 1 }, { unique: true, sparse: true });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
