var mongoose=require('mongoose');
var async=require('async');
var juice=require('juice');
var nodemailer = require('nodemailer');
var sendmailTransport=require('nodemailer-sendmail-transport');
var hbs = require('nodemailer-express-handlebars');
var conf = require('./conf.json');

var mailer = nodemailer.createTransport(sendmailTransport({path: '/usr/sbin/sendmail'}));

mailer.use('compile', function(mail, callback){
    var tasks=[function(cb) {
        hbs(options)(mail,cb);
    }];
    async.series(tasks,function() {
        mail.data.html=juice(mail.data.html);
        mail.data.html = (mail.data.html + '').replace(/\!br79\!/g, '<br>');
        callback();
    });
});

var flag=0;

var options = {
    viewEngine: {
      extname: '.hbs',
      layoutsDir: 'views/email/',
      defaultLayout : 'template'
    },
    viewPath: 'views/email/',
    extName: '.hbs'
};

var Posts = mongoose.model('Posts', {
    title : String,
    category: String,
    date: String,
    content: String,
    author: String,
    status: String,
    centrale:Boolean,
    iteem:Boolean
});

var connection = "mongodb://"+conf.auth.login+':'+conf.auth.pw+'@'+conf.auth.addr+"/"+conf.auth.db;

var today=new Date();
today.setHours(23,59,59,999);

mongoose.connect(connection,function(err,data){
    if(err) throw err;
    Posts.find({status:"success",date:{$lt:today},centrale:true},sendPosts);
    Posts.find({status:"success",date:{$lt:today},iteem:true},sendPosts);
});


/* ========================================================================= */

function sendPosts(err, posts) {
    if(err) throw err;
    if (!posts[0]) {
        mongoose.connection.close();
        process.exit(0);
    }
    var dest=(posts[id].centrale)?'centrale':'iteem';

    var output={comm:[],events:[],misc:[],special:[]};

    for (var id in posts) {
        posts[id].content = (posts[id].content + '').replace(/(\r\n|\n\r|\r|\n|&#10;&#13;|&#13;&#10;|&#10;|&#13;)/g, '!br79!');
        switch (posts[id].category) {
            case "Communication":
                output["comm"].push(posts[id]);
                output["comm"][output["comm"].length-1]["alink"]="comm_"+id;
                break;
             case "Evenements":
                output["events"].push(posts[id]);
                output["events"][output["events"].length-1]["alink"]="event_"+id;
                break;
            case "Divers":
                output["misc"].push(posts[id]);
                output["misc"][output["misc"].length-1]["alink"]="misc_"+id;
                break;
            case "Exceptionnel":
                output["special"].push(posts[id]);
                output["special"][output["special"].length-1]["alink"]="spe_"+id;
                break;
        }
    }
    var date = new Date();
    var day = date.getDate();
    var month = date.getMonth()+1;
    var year = date.getFullYear();
    date=day+"/"+month+"/"+year;

    console.log(posts);
    process.exit(0);

    var receivers="";
    for (var d in conf.mail.destination[dest]) {
        receivers+=conf.mail.destination[dest][d]+','
    }
    receivers=receivers.slice(-1);

    mailer.sendMail({
        from: conf.mail.fromAddress,
        to: receivers,
        replyTo: '',
        subject: 'Centralink du '+date, // TODO: date
        template: 'email_body',
        context: {
            dateNow: date,
            posts: output
        }
    }, function(err) {
        if(err) throw err;
    });
    updatePosts(dest);
    flag++;
    if(flag==2) {
        expirePosts();
    }
}

function updatePosts(dest) {
    var filter={"status":"success"}
    filter[dest]=true;
    Posts.update(filter,{$set:{"status":"sent"}},{multi:true},handleError);
}

function expirePosts() {
    Posts.update({"status":"waiting",date:{$lt:today}},{$set:{"status":"failure"}},{multi:true},function(err) {
        if(err) throw err;
        mongoose.connection.close;
        mailer.close();
        process.exit(0);
    });
}

function handleError(err) {
    if(err) throw err;
};