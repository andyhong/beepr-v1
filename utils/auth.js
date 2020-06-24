const passport = require("passport")
const fetch = require("node-fetch")
const User = require("../models/User")

module.exports = {
  checkAuth: (req, res, next) => {
    if (req.user) {
      next()
    } else {
      res.redirect("/")
    }
  },
  getRefreshToken: (req, res, next) => {
    User.findById(req.user, async (err, user) => {
      if (err) {
        next(err)
      }
      const body = {
        client_id: process.env.PCO_CLIENT_ID,
        client_secret: process.env.PCO_CLIENT_SECRET,
        refresh_token: user.refreshToken,
        grant_type: "refresh_token",
      }
      try {
        const response = await fetch(
          `https://api.planningcenteronline.com/oauth/token`,
          {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }
        )
        const data = await response.json()
        const newTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        }
        await user.updateOne(newTokens)
        next()
      } catch (err) {
        next(err)
      }
    })
  },
}
