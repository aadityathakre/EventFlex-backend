import Event from "./Event.model.js"
import User from "./User.model.js"; // assuming organizer or host is a user with role = "organizer" or "host"

import { mongoose, Schema } from "mongoose";

const EventApplicationSchema = new mongoose.Schema(
  {
    event: { 
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    applicant: { 
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    host: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    application_status:
    {
      type: String,
      enum :["pending", "accepted", "rejected"],
      default: "pending",
    },
    cover_letter: {
      type: String,
        trim: true,
    },
    proposed_rate: {
      type: mongoose.Types.Decimal128,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);


const EventApplication = mongoose.model("EventApplication", EventApplicationSchema);
export default EventApplication;
