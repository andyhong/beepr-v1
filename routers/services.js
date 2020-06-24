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

// GET /services
// Displays all active services at time of query

router.get("/", checkAuth, getRefreshToken, (req, res, next) => {
  User.findById(req.user, async (err, user) => {
    if (err) {
      next(err)
    }
    try {
      const response = await fetch(
        `https://api.planningcenteronline.com/check-ins/v2/event_times?include=event&order=-starts_at&per_page=100`,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      )
      const data = await response.json()
      const getEventInfo = () => {
        const obj = {}
        data.included.map((event) => {
          obj[event.id] = event.attributes.name
        })
        return obj
      }
      const eventInfo = getEventInfo()
      const activeServices = data.data
        .filter((service) => {
          return moment(service.attributes.starts_at) < moment()
        })
        .filter((service) => {
          return moment(service.attributes.hides_at) > moment()
        })
        .map((service) => {
          return {
            eventName: eventInfo[service.relationships.event.data.id],
            eventStart: moment(service.attributes.starts_at)
              .tz(user.orgTZ)
              .format("MMM Do, ha"),
            eventTimeId: service.id,
          }
        })
      res.render("service_list", {
        services: activeServices,
        msg: req.flash("msg"),
      })
    } catch (err) {
      next(err)
    }
  })
})

router.get("/page", (req, res, next) => {
  res.render("page", { msg: req.flash("msg") })
})

router.post(
  "/page",
  checkAuth,
  getRefreshToken,
  body("code").trim().isLength({ min: 4, max: 4 }),
  (req, res, next) => {
    const errors = validationResult(req)
    const code = req.body.code.toUpperCase()
    if (!errors.isEmpty()) {
      req.flash("msg", "Invalid security code. Please try again.")
      res.redirect("/services/page")
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
            res.redirect("/services/page")
          } else if (!emergencyContact[0].phone) {
            req.flash(
              "msg",
              "Invalid phone number on file. Please see a staff member."
            )
            res.redirect("/services/page")
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
                res.redirect("/services/page")
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
                res.redirect("/services/page")
              })
          } else {
            req.flash(
              "msg",
              "Invalid phone number on file. Please see a staff member."
            )
            res.redirect("/services/page")
          }
        } catch (err) {
          next(err)
        }
      })
    }
  }
)

// GET /services/:id
// Displays name and time of service and allows user to input security code

router.get("/:id", checkAuth, getRefreshToken, (req, res, next) => {
  User.findById(req.user, async (err, user) => {
    if (err) {
      next(err)
    }
    try {
      const response = await fetch(
        `https://api.planningcenteronline.com/check-ins/v2/event_times/${req.params.id}?include=event`,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      )
      const data = await response.json()
      const eventInfo = {
        eventName: data.included[0].attributes.name,
        eventStart: moment(data.data.attributes.starts_at)
          .tz(user.orgTZ)
          .format("MMM Do, ha"),
        eventId: req.params.id,
      }
      res.render("service_detail", { event: eventInfo, msg: req.flash("msg") })
    } catch (err) {
      next(err)
    }
  })
})

// POST /services/:id
// Retrieves emergency contact and sends a text msg based on security code input

router.post(
  "/:id",
  checkAuth,
  getRefreshToken,
  body("code").trim().isLength({ min: 4, max: 4 }),
  (req, res, next) => {
    const errors = validationResult(req)
    const code = req.body.code.toUpperCase()
    if (!errors.isEmpty()) {
      req.flash("msg", "Security code is invalid. Please try again.")
      res.redirect("/services/" + req.params.id)
    } else {
      User.findById(req.user, async (err, user) => {
        if (err) {
          next(err)
        }
        try {
          const response = await fetch(
            `https://api.planningcenteronline.com/check-ins/v2/event_times/${req.params.id}/event_period/check_ins?include=event,event_times`,
            {
              headers: { Authorization: `Bearer ${user.accessToken}` },
            }
          )
          const data = await response.json()
          const findEmergencyContact = data.data
            .map((checkin) => {
              return checkin.attributes
            })
            .filter((checkin) => {
              return checkin.security_code == code
            })
          if (findEmergencyContact.length < 1) {
            req.flash("msg", "Security code is invalid. Please try again.")
            res.redirect("/services/" + req.params.id)
          } else if (!findEmergencyContact[0].emergency_contact_phone_number) {
            req.flash(
              "msg",
              "Invalid phone number on file. Please see a staff member."
            )
            res.redirect("/services/" + req.params.id)
          } else {
            const emergencyContact = {
              name: findEmergencyContact[0].emergency_contact_name,
              phone: findEmergencyContact[0].emergency_contact_phone_number,
            }
            if (
              emergencyContact.phone.length == 11 &&
              emergencyContact.phone.chatAt(0) == "1"
            ) {
              client.messages
                .create({
                  body: `${user.orgName}: Your assistance is needed at your child's classroom.`,
                  to: `+17149068336`,
                  from: `+12018347990`,
                })
                .then((success) => {
                  req.flash("msg", "Emergency contact paged successfully.")
                  res.redirect("/services")
                })
            } else if (emergencyContact.phone.length == 10) {
              client.messages
                .create({
                  body: `${user.orgName}: Your assistance is needed at your child's classroom.`,
                  to: `+17149068336`,
                  from: `+12018347990`,
                })
                .then((success) => {
                  req.flash("msg", "Emergency contact paged successfully.")
                  res.redirect("/services")
                })
            } else {
              req.flash(
                "msg",
                "Invalid phone number on file. Please see a staff member."
              )
              res.redirect("/services/" + req.params.id)
            }
          }
        } catch (err) {
          next(err)
        }
      })
    }
  }
)

module.exports = router
