const path = require("path")
const express = require("express")
const morgan = require("morgan")
const session = require("express-session")
const passport = require("passport")
const mongoose = require("mongoose")
const flash = require("connect-flash")
const MongoStore = require("connect-mongo")(session)
const connectDB = require("./config/db")

// load env variables
require("dotenv").config({ path: "./config/config.env" })

// initialize auth strategy + db
require("./config/passport")(passport)
connectDB()

// initialize Express server + middleware
const app = express()
app.set("views", path.join(__dirname, "./views"))
app.set("view engine", "ejs")

if (process.env.NODE_ENV == "development") {
  app.use(morgan("dev"))
}

app.use(express.static("public"))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
  })
)
app.use(passport.initialize())
app.use(passport.session())
app.use(function (req, res, next) {
  res.locals.user = req.user || null
  next()
})
app.use(flash())

// initialize routers
app.use("/auth", require("./routers/auth"))
app.use("/page", require("./routers/page"))

app.get("/", (req, res) => {
  res.render("index")
})

app.get("/login", (req, res) => {
  res.render("login")
})

const PORT = process.env.PORT || 3000

app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
)
