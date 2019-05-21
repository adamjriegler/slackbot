/* eslint-disable no-shadow */

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import botkit from 'botkit';
import dotenv from 'dotenv';
import yelp from 'yelp-fusion';

dotenv.config({ silent: true });

// initialize
const app = express();

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM((err) => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'Adam is here!');
});
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

const yelpClient = yelp.client(process.env.YELP_API_KEY);

controller.hears(['food', 'hungry', 'eat', 'restaurant'], 'direct_message,direct_mention,mention', (bot, message) => {
  bot.startConversation(message, (err, conv) => {
    if (!err) {
      conv.ask('Can I help you find a place to eat?', [
        {
          pattern: bot.utterances.yes,
          callback: (res, conv) => {
            conv.say('Okay! Let me help!');
            conv.next();
            conv.ask('What are you hungry for?', (food, conv) => {
              conv.ask('Okay! And where do you want to eat?', (location, conv) => {
                bot.reply(message, 'Okay! Let me look for a place for you!');
                conv.next();
                yelpClient.search({
                  term: food.text,
                  location: location.text,
                }).then((response) => {
                  bot.reply(message, response.jsonBody.businesses[0].name);
                  bot.reply(message, {
                    attachments: [
                      {
                        title: response.jsonBody.businesses[0].name,
                        title_link: response.jsonBody.businesses[0].url,
                        text: response.jsonBody.businesses[0].rating,
                        image_url: response.jsonBody.businesses[0].image_url,
                      },
                    ],
                  });
                }).catch((e) => {
                  console.log(e);
                });
                conv.next();
              });
              conv.next();
            });
            conv.next();
          },
        },
        {
          pattern: bot.utterances.no,
          callback: (res, conv) => {
            bot.reply(message, 'bye bye');
            conv.stop();
          },
        },
      ]);
    }
  });
});

controller.hears('joke', 'direct_message,direct_mention,mention', (bot, message) => {
  bot.startConversation(message, (err, conv) => {
    if (!err) {
      conv.ask('Do you want to hear a joke?', [
        {
          pattern: bot.utterances.yes,
          callback: (res, conv) => {
            conv.ask('Would you like to hear a knock knock or a dirty joke?', (joke, conv) => {
              if (joke.text.valueOf() === 'knock knock'.valueOf()) {
                conv.ask('Knock knock', (ans, conv) => {
                  conv.ask('Tank', (ans, conv) => {
                    conv.say('You are welcome!');
                    conv.next();
                  });
                  conv.next();
                });
                conv.next();
              } else {
                conv.say('What do you call someone who refuses to fart in public? A private tutor.');
                conv.next();
              }
            });
            conv.next();
          },
        },
      ]);
      conv.next();
    }
  });
});


// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`listening on: ${port}`);
