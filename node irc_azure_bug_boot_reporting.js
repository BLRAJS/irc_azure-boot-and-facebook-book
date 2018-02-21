var irc = require('irc');
var myuserClient = new irc.Client('irc.freenode.net', 'BugTrackerIRCBot', {
    autoConnect: false
});
myuserClient.connect(5, function(serverReply) {
    console.log("Connected!\n", serverReply);
    myuserClient.join('#chanelWithButReporting', function(input) {
        console.log("Joined #chanelWithButReporting");
        myuserClient.say('#chanelWithButReporting', "Hi, there.");
    });
});

var DocumentClient = require('documentdb').DocumentClient;
var host = "https://botdb.documents.azure.com:443/";
var masterKey = "<PRIMARY KEY>";
var docmyuserClient = new DocumentClient(host, { masterKey: masterKey });

myuserClient.addListener('message', function(from, to, text) {
            var str = text;
            if (str.indexOf('reportabug') === -1) {
                if (str.indexOf('custombug #') === -1) {
                    myuserClient.say('#chanelWithButReporting', 'Send me commands like,\n reportabug \n custombug # <custombug NO.>");
                    }
                    else {
                        myuserClient.say('#chanelWithButReporting', "So you need info about " + text);
                        myuserClient.say('#chanelWithButReporting', "Wait for a moment!");
                        var t = text.substring(6, text.length);
                        var temp = t.trim();
                        var querySpec = {
                            query: 'SELECT * FROM Bugs b WHERE  b.id= @id',
                            parameters: [{
                                name: '@id',
                                value: temp
                            }]
                        };
                        docmyuserClient.queryDocuments('dbs/BugDB/colls/Bugs', querySpec).toArray(function(err, results) {
                            if (results.length > 0) {
                                myuserClient.say('#chanelWithButReporting', "[" + results[0].url + "] [Status]: " + results[0].status + " [Title]:" + results[0].title);
                            } else {
                                myuserClient.say('#chanelWithButReporting', 'No bugs found.');
                            }
                        });
                    }
                } else {
                    myuserClient.say('#chanelWithButReporting', "So you need a Bug Report!");
                    myuserClient.say('#chanelWithButReporting', "Wait for a moment!");
                    var querySpec = {
                        query: 'SELECT * FROM Bugs b WHERE  b.status= @status',
                        parameters: [{
                            name: '@status',
                            value: 'Open'
                        }]
                    };
                    docmyuserClient.queryDocuments('dbs/BugDB/colls/Bugs', querySpec).toArray(function(err, results) {
                        myuserClient.say('#chanelWithButReporting', 'Total Open Bugs:' + results.length);
                    });
                    var querySpec = {
                        query: 'SELECT * FROM Bugs b WHERE  b.status= @status',
                        parameters: [{
                            name: '@status',
                            value: 'Closed'
                        }]
                    };
                    docmyuserClient.queryDocuments('dbs/BugDB/colls/Bugs', querySpec).toArray(function(err, results) {
                        myuserClient.say('#chanelWithButReporting', 'Total Closed Bugs:' + results.length);
                    });
                }

            });