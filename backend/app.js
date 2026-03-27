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

// Искусственная задержка

//app.use((req, res, next) => {
//    const delay = 1000;
//    setTimeout(next, delay);
//});

app.use('/', [userRoutes, messageRoutes, classRoutes, sessionRoutes, classchatRoutes, requestRoutes]);

module.exports = { app };