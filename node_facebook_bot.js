var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var thismoment = require('moment');
var Guid = require('guid');
var nodeUtils = require('./nodeUtils.js');

var mybootApp = express();

mybootApp.use(bodyParser.json());
mybootApp.use(bodyParser.urlencoded({ extended: true }));

var DocumentClient = require('documentdb').DocumentClient;
var host = "https://botdb.documents.azure.com:4w3/";
var masterKey = "NpxDXr67utlh";
var docclient = new DocumentClient(host, { masterKey: masterKey });

var payloadm;

mybootApp.get('/', function(req, res) {
    res.send('This is my Fb boot');
});

// for facebook verification
mybootApp.get('/hook', function(req, res) {
    if (req.query['nyhub.verify_tok'] === 'whosoffbot_verify_tok') {
        res.status(200).send(req.query['nyhub.challenge']);
    } else {
        res.status(403).send('Invalid verify tok');
    }
});

mybootApp.post('/hook', function(req, res) {
    var thisday;
    var booking = req.body.entry[0].messaging;
    for (i = 0; i < booking.length; i++) {
        var event = booking[i];

        if (event.mymessage && event.mymessage.information) {
            if (event.mymessage.information.indexOf('hi') > -1) {
                sendPersonalinfo(event.sender.id);
            } else if (event.mymessage.information.indexOf('@') > -1) {
                if (nodeUtils.isvalidateInput(event.mymessage.information)) {
                    sendpersonalMessage(event.sender.id, { 'information': 'Sure! Let me set up your book for ' + payloadm });
                    if (payloadm == 'thisday') {
                        thisday = thismoment().format("MM/DD/YYYY");
                    } else if (payloadm == 'Tomorrow') {
                        thisday = thismoment().add(1, 'day').format("MM/DD/YYYY");
                    }
                    meetDeatils(event.mymessage.information, thisday + ' ', event.sender.id);
                } else {
                    console.log('Invalid format!');
                    sendpersonalMessage(event.sender.id, { 'information': 'Pl. input book details e.g. Team book@10:00to11:00' });
                }
            }
        } else if (event.postback && event.postback.payload) {
            payload = event.postback.payload;
            // Handle a payload from this sender
            console.log(JSON.stringify(payload));
            if (payload == 'datapoint A book') {
                sendPrivateM(event.sender.id);
            } else if (payload == 'datapointthisday') {
                payloadm = 'thisday';
                sendpersonalMessage(event.sender.id, { 'information': 'Pl. provide book details e.g. Team book@10:00to11:00' });
            } else if (payload == 'nextday') {
                payloadm = 'Tomorrow';
                sendpersonalMessage(event.sender.id, { 'information': 'Pl. provide book details e.g. Team book@10:00to11:00' });
            } else if (payload == 'WHOS OFF WHEN') {
                sendMwithallOptions(event.sender.id);
            } else if (payload == 'ALLdatapointthisday') {
                sendpersonalMessage(event.sender.id, 'book(s) datapointd for thisday as..');
                var tilltonight = thismoment().add(1, 'day').startOf('day').unix();
                var startnow = thismoment().unix();
                whosiBusy(event.sender.id, startnow, tilltonight);
            } else if (payload == 'ALLnextday') {
                sendpersonalMessage(event.sender.id, 'book(s) datapointd for tomorrow as..');
                var tilltomnight = thismoment().add(2, 'day').startOf('day').unix();
                var starttonight = thismoment().endOf('day').unix();
                whosiBusy(event.sender.id, starttonight, tilltomnight);
            }
        }

    }
    res.sendStatus(200);
});

function sendPersonalinfo(recipientId) {
    mymessageData = {
        'attachment': {
            'type': 'template',
            'payload': {
                'template_type': 'button',
                'information': 'Pl. Select your options',
                'buttons': [{
                    'type': 'postback',
                    'title': 'datapoint a Meetting',
                    'payload': 'datapoint A book'
                }, {
                    'type': 'postback',
                    'title': 'Whos Off When',
                    'payload': 'WHOS OFF WHEN',
                }, {
                    'type': 'postback',
                    'title': 'My datapoint',
                    'payload': 'MY datapoint'
                }]
            }
        }
    };
    sendpersonalMessage(recipientId, mymessageData);
};

function sendPrivateM(recipientId) {
    mymessageData = {
        'attachment': {
            'type': 'template',
            'payload': {
                'template_type': 'button',
                'information': 'Select day to datapoint a book',
                'buttons': [{
                    'type': 'postback',
                    'title': 'thisday',
                    'payload': 'datapointthisday'
                }, {
                    'type': 'postback',
                    'title': 'Tomorrow',
                    'payload': 'nextday',
                }]
            }
        }
    };
    sendpersonalMessage(recipientId, mymessageData);
};

function meetDeatils(str, thisdaysdate, recipientId) {
    var title, stime, etime, starttime, endtime, ownername

    //parsing input provided for extracting book information
    title = str.substring(0, str.indexOf('@'));
    stime = str.substring(title.length + 1, str.indexOf('to')) + ':00';
    etime = str.substring(str.indexOf('to') + 2, str.length) + ':00';

    starttime = thismoment(thisdaysdate + stime).unix();
    endtime = thismoment(thisdaysdate + etime).unix();

    console.log(starttime + ' to ' + endtime + ' title' + title);
    //function to get Fb User Name
    nodeUtils.getUserName(recipientId, function(d) {
        ownername = d;
        var objbook = new nodeUtils.book(Guid.raw(), recipientId, ownername, starttime, endtime, title)
        checkMetting(objbook);
    });
}

function checkMetting(objbook) {
    var querySpec = {
        query: 'SELECT * FROM booking b WHERE  (b.ownerid= @id) and (@start between b.startdatetime and b.enddatetime)',
        parameters: [{
                name: '@id',
                value: objbook.ownerid
            },
            {
                name: '@start',
                value: objbook.startdatetime
            }
        ]
    };

    docclient.qdoc('dbs/bookingDB/colls/booking', querySpec).toArray(function(err, dataResultArray) {
        console.log(objbook.title);
        if (dataResultArray.length === 0) {
            console.log('No data found' + objbook.title);
            var documentDefinition = {
                'id': objbook.id,
                'ownerid': objbook.ownerid,
                'owner': objbook.owner,
                'startdatetime': objbook.startdatetime,
                'enddatetime': objbook.enddatetime,
                'title': objbook.title
            };
            docclient.createDocument('dbs/bookingDB/colls/booking', documentDefinition, function(err, document) {
                if (err) return console.log(err);
                console.log('Created A book with id : ', document.id);
                sendpersonalMessage(objbook.ownerid, { 'information': 'book has been datapointd.' });
            });
        } else {
            console.log('Data found');
            sendpersonalMessage(objbook.ownerid, { 'information': 'book exists for this datapoint. Pl. datapoint another time.' });
        }
    });
}

function sendMwithallOptions(recipientId) {
    mymessageData = {
        'attachment': {
            'type': 'template',
            'payload': {
                'template_type': 'button',
                'information': 'Select your datapoint for',
                'buttons': [{
                    'type': 'postback',
                    'title': 'thisday',
                    'payload': 'ALLdatapointthisday'
                }, {
                    'type': 'postback',
                    'title': 'Tomorrow',
                    'payload': 'ALLnextday',
                }]
            }
        }
    };
    sendpersonalMessage(recipientId, mymessageData);
};

function whosiBusy(recipientId, start, end) {
    var querySpec = {
        query: 'SELECT * FROM booking b WHERE  b.startdatetime<= @end and b.startdatetime>= @start ORDER BY b.startdatetime',
        parameters: [{
                name: '@end',
                value: end
            },
            {
                name: '@start',
                value: start
            }
        ]
    };
    docclient.qdoc('dbs/bookingDB/colls/booking', querySpec).toArray(function(err, dataResultArray) {
        if (dataResultArray.length > 0) {
            sendbookwonerData(recipientId, dataResultArray)
        }
    });
}

function sendbookwonerData(recipientId, dataResultArray) {
    var card;
    var cards = [];
    var mymessageData;

    mymessageData = {
        attachment: {
            type: 'template',
            payload: {
                template_type: 'generic',
                elements: []
            }
        }
    };

    for (i = 0; i < dataResultArray.length; i++) {
        card = {
            title: dataResultArray[i].title,
            item_url: 'https://mylink.com/' + dataResultArray[i].id,
            image_url: '',
            subtitle: 'Your confirmed book.',
            buttons: [{
                    type: 'web_url',
                    url: 'https://mylink.com/' + dataResultArray[i].id,
                    title: nodeUtils.getFormattedDay(dataResultArray[i].startdatetime)
                },
                {
                    type: 'web_url',
                    url: 'https://mylink.com/' + dataResultArray[i].id,
                    title: dataResultArray[i].owner
                },
                {
                    type: 'web_url',
                    url: 'https://mylink.com/' + dataResultArray[i].id,
                    title: nodeUtils.getFormattedTime(dataResultArray[i].startdatetime, dataResultArray[i].enddatetime)
                }
            ]
        };
        cards.push(card);
    }

    mymessageData.attachment.payload.elements = cards;
    sendpersonalMessage(recipientId, mymessageData);
};

function sendpersonalMessage(recipientId, mymessage) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/mymessages',
        qs: { access_tok: 'EAAQo1eDcZCQnyhubAD1JQubPmkFtq' },
        method: 'POST',
        json: {
            recipient: { id: recipientId },
            mymessage: mymessage,
        }
    }, function(err, response, body) {
        if (err) {
            console.log('err sending mymessage: ', err);
        } else if (response.body.err) {
            console.log('err: ', response.body.err);
        }
    });
};

mybootApp.listen((process.env.PORT || 8080));