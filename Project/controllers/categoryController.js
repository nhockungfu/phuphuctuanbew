var express = require('express');

var r = express.Router();

r.get('/', function(req, res) {
    var vm = {
        layout: false,
    };
    res.render('dangNhap', vm);
});
module.exports = r;
