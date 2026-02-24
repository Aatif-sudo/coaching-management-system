const express = require("express");
const health = require("./health");
const auth = require("./auth");
const users = require("./users");
const students = require("./students");
const batches = require("./batches");
const attendance = require("./attendance");
const fees = require("./fees");
const notes = require("./notes");
const notifications = require("./notifications");
const dashboard = require("./dashboard");

const router = express.Router();

router.use(health);
router.use(auth);
router.use(users);
router.use(students);
router.use(batches);
router.use(attendance);
router.use(fees);
router.use(notes);
router.use(notifications);
router.use(dashboard);

module.exports = router;
