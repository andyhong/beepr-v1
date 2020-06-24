const express = require("express")
const router = express.Router()
const fetch = require("node-fetch")
const moment = require("moment-timezone")
const { checkAuth, getRefreshToken } = require("../utils/auth")
const { body, validationResult } = require("express-validator")

//initialize twilio
const twilio = require("twilio")
const User = require("../models/User")
const client = new twilio(
  process.env.TWILIO_ACCOUNTSID,
  process.env.TWILIO_AUTHTOKEN
)

router.get("/", (req, res, next) => {
  res.render("page", { msg: req.flash("msg") })
})

router.post(
  "/",
  checkAuth,
  getRefreshToken,
  body("code").trim().isLength({ min: 4, max: 4 }),
  (req, res, next) => {
    const errors = validationResult(req)
    const code = req.body.code.toUpperCase()
    if (!errors.isEmpty()) {
      req.flash("msg", "Invalid security code. Please try again.")
      res.redirect("/page")
    } else {
      User.findById(req.user, async (err, user) => {
        if (err) {
          next(err)
        }
        try {
          const fetchServices = await fetch(
            `https://api.planningcenteronline.com/check-ins/v2/event_times?include=event&order=-starts_at&per_page=100`,
            {
              headers: { Authorization: `Bearer ${user.accessToken}` },
            }
          )
          const fetchServicesJson = await fetchServices.json()
          const activeServices = await fetchServicesJson.data
            .filter((service) => {
              return moment(service.attributes.starts_at) < moment()
            })
            .filter((service) => {
              return moment(service.attributes.hides_at) > moment()
            })
            .map((service) => {
              return service.id
            })
          const aggregateCheckins = await Promise.all(
            activeServices.map(async (service) => {
              const response = await fetch(
                `https://api.planningcenteronline.com/check-ins/v2/event_times/${service}/event_period/check_ins`,
                {
                  headers: { Authorization: `Bearer ${user.accessToken}` },
                }
              )
              const data = await response.json()
              return data.data
            })
          )
          const emergencyContact = aggregateCheckins
            .reduce((a, b) => {
              return a.concat(b)
            })
            .map((checkin) => {
              return {
                code: checkin.attributes.security_code,
                phone: checkin.attributes.emergency_contact_phone_number,
              }
            })
            .filter((checkin) => {
              return checkin.code == code
            })
          if (emergencyContact.length < 1) {
            req.flash("msg", "Invalid security code. Please try again.")
            res.redirect("/page")
          } else if (!emergencyContact[0].phone) {
            req.flash(
              "msg",
              "Invalid phone number on file. Please see a staff member."
            )
            res.redirect("/page")
          } else if (
            emergencyContact[0].phone.length == 11 &&
            emergencyContact[0].phone.charAt(0) == "1"
          ) {
            client.messages
              .create({
                body: `${user.orgName}: Your child requires your assistance.`,
                to: `+17149068336`,
                from: `+12018347990`,
              })
              .then((success) => {
                req.flash("msg", "Emergency contact paged successfully.")
                res.redirect("/page")
              })
          } else if (emergencyContact[0].phone.length == 10) {
            client.messages
              .create({
                body: `${user.orgName}: Your child requires your assistance.`,
                to: `+17149068336`,
                from: `+12018347990`,
              })
              .then((success) => {
                req.flash("msg", "Emergency contact paged successfully.")
                res.redirect("/page")
              })
          } else {
            req.flash(
              "msg",
              "Invalid phone number on file. Please see a staff member."
            )
            res.redirect("/page")
          }
        } catch (err) {
          next(err)
        }
      })
    }
  }
)

module.exports = router
