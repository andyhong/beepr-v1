const express = require("express")
const router = express.Router()
const passport = require("passport")
const { getRefreshToken } = require("../utils/auth")

router.get(
  "/login",
  passport.authenticate("oauth2", { scope: ["people", "check_ins"] })
)

router.get(
  "/callback",
  passport.authenticate("oauth2", {
    scope: ["people", "check_ins"],
    failureRedirect: "/",
  }),
  (req, res) => {
    res.redirect("/page")
  }
)

router.get("/token", getRefreshToken, (req, res) => {
  res.redirect("/page")
})

router.get("/logout", (req, res) => {
  req.logout()
  res.redirect("/")
})

module.exports = router
