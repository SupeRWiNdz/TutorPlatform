const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const classRoutes = require('./routes/classRoutes');
const classchatRoutes = require('./routes/classchatRoutes');
const requestRoutes = require('./routes/requestRoutes');

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.use('/', [userRoutes, messageRoutes, classRoutes, sessionRoutes, classchatRoutes, requestRoutes]);

module.exports = { app };