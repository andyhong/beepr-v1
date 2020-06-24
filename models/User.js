const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema(
  {
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    pcoId: {
      type: String,
      required: true,
    },
    orgName: {
      type: String,
      required: true,
    },
    orgTZ: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model("User", UserSchema)
