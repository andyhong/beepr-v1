const OAuth2Strategy = require("passport-oauth2").Strategy
const User = require("../models/User")
const fetch = require("node-fetch")

module.exports = (passport) => {
  passport.use(
    new OAuth2Strategy(
      {
        authorizationURL:
          "https://api.planningcenteronline.com/oauth/authorize",
        tokenURL: "https://api.planningcenteronline.com/oauth/token",
        clientID: process.env.PCO_CLIENT_ID,
        clientSecret: process.env.PCO_CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let me = await fetch(
            `https://api.planningcenteronline.com/people/v2/me?include=organization`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )
          let data = await me.json()
          const newUser = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            pcoId: data.data.id,
            orgName: data.included[0].attributes.name,
            orgTZ: data.included[0].attributes.time_zone,
          }
          let user = await User.findOne({ pcoId: data.data.id })
          if (user) {
            await user.updateOne(newUser)
            await user.save()
            done(null, user)
          } else {
            user = await User.create(newUser)
            done(null, user)
          }
        } catch (err) {
          console.error(err)
        }
      }
    )
  )

  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user))
  })
}
