var express = require('express'),
    crypto = require('crypto'),
    emailExistence = require('email-existence'),
    fs = require('fs'),
    multer = require('multer'),
    path = require('path'),
    userRepo = require('../models/userRepo'),
    restrict = require('../middle-wares/restrict'),
    categoryRepo = require('../models/categoryRepo'),
    produceRepo = require('../models/producesRepo');
    nodemailer = require('nodemailer'),
    categoryRepo = require('../models/categoryRepo'),
    q = require('q'),
    randomstring = require("randomstring");

var r = express.Router();

r.get('/dangky', function (req, res) {
    res.render('user/dangKy', {layout: 'main', layoutModels: res.locals.layoutModels, showError: false});
});

r.post('/dangky', function (req, res) {
    var email = req.body.txtEmail,
        pass = crypto.createHash('md5').update(req.body.txtPassWord).digest('hex');
    var user = {
        email: email,
        pass: pass,
        point: 0
    }
    var _res = res;
    var layoutModels = res.locals.layoutModels;
    emailExistence.check(email, function (err, res) {
        if (res) {
            userRepo.loadDetail2(email).then(function (rows) {
                if (rows != null) {
                    console.log('co trong csdl roi')
                    _res.render('user/dangKy',
                        {
                            layoutModels: layoutModels,
                            layout: 'main',
                            showError: true
                        });
                } else {
                    console.log('chua co trong csdl')
                    userRepo.insert(user).then(function (insertId) {
                        _res.render('user/dangKyThanhCong',
                            {
                                layoutModels: layoutModels,
                                email: email,
                                layout: false
                            });
                        console.log('them thanh cong ' + insertId);
                    }).fail(function (err) {
                        console.log(err);
                        ;
                        res.end('fail');
                    });
                }
            })
            console.log('co thuc');
        } else {
            console.log('Khong co thuc');
            _res.render('user/dangKy',
                {
                    layoutModels: layoutModels,
                    layout: 'main',
                    showError: true
                });
        }
    });
});

r.get('/dangnhap', function (req, res) {
    if (req.session.isLogged === true) {
        res.redirect('/home');
    } else {
        res.render('user/dangNhap2', {
            layout: 'main',
            layoutModels: res.locals.layoutModels,
            showError: false,
        });
    }
});

r.post('/dangnhap', function (req, res) {
    var email = req.body.txt_email,
        pass = crypto.createHash('md5').update(req.body.txt_pass).digest('hex');

    console.log(pass)

    var entity = {
        email: email,
        pass: pass
    };
    var f = false;
    userRepo.checkAccount(entity).then(function (user) {

        if (user.email == null) {
            console.log('dang nhap that bai')
            res.render('user/dangNhap2', {
                layoutModels: res.locals.layoutModels,
                layout: 'main',
                showError: true
            });
        } else {
                if(user.sum==0)
                    f=true;
                if(parseInt(user.point)/parseInt(user.sum)*100>=80){
            if (user.sum == 0)
                f = true;
            if (user.point / user.sum * 100 >= 80) {

                f = true;
            }

            console.log('dang nhap thanh cong')
            req.session.isLogged = true;
            req.session.user = user;
            req.session.isBid=f;
            req.session.isBid = f;

            var url = '/home';
            if (req.query.retUrl) {
                url = req.query.retUrl;
            }
            res.redirect(url);
        }
    }}).fail(function (err) {
        console.log(err);

        res.end('fail');
    });
});

r.post('/dangxuat', restrict, function (req, res) {
    req.session.isLogged = false;
    req.session.isBid = false;
    req.session.user = null;
    req.session.cookie.expires = new Date(Date.now() - 1000);
    res.redirect(req.headers.referer);
});

r.get('/a', function (req, res) {
    res.render('user/dangKyThanhCong', {layout: false})
})

r.get('/reset-pass/:user_email', function (req, res) {
    var email = req.params.user_email;
    if (!email) {
        res.redirect('Thao tác không hợp lệ!');
    }

    userRepo.checkForWaitingChangePass(email).then(function (result) {
        var is_wait = result.waiting_for_change_pass;

        var bit_false = new Buffer([0x00]);
        var bit_true = new Buffer([0x01]);

        //nếu csdl không có lưu vấn đề chờ reset mật khẩu
        if (is_wait[0] == bit_false[0]) {
            res.end('OOOP: Invalid operation!');
        }

        //nếu csdl đánh dấu: đang chờ reset khẩu -> mật khẩu sẽ bị đổi bằng chuỗi random và được gửi về mail người dùng.
        if (is_wait[0] == bit_true[0]) {
            var rand_pass = randomstring.generate(10);
            userRepo.changeUserPass(email, rand_pass).then(function () {

                var transporter = nodemailer.createTransport({ //cấu hình mail server
                    service: 'Gmail',
                    auth: {
                        user: 'dever.group.sp@gmail.com',
                        pass: 'dever123'
                    }
                });

                var mainOptions = { // thiết lập đối tượng, nội dung gửi mail
                    from: 'Dever Group',
                    to: 'vsp1308@gmail.com',
                    subject: 'Đổi mật khẩu thành công',
                    text: 'You recieved message from Vòng Say Phu',
                    html: '<h3>Xin chào bạn!</h3><p><b><a href="http://localhost:3000/home">DevGroup</a></b> gửi bạn mail thông báo: <b><i>Reset mật khẩu thành công.</i></b></p><p>Mật khẩu mới của bạn là: <b>' + rand_pass + '</b></p>'
                }

                transporter.sendMail(mainOptions, function (err, info) {
                    if (err) {
                        console.log(err);
                        res.end('Lỗi gửi mail...');
                    } else {
                        console.log('Message sent: ' + info.response);
                        res.redirect('/');
                    }
                });

                userRepo.setNoneWaitingChangePass(email);

                res.end('Change password successfully!');
            });
        }
    })


    // producesRepo.getProInfoById(proId)
    //     .then(function (rows) {
    //         var describe_path = rows[0].describe_path;
    //
    //         console.log(rows);
    //
    //
    //         var data = {
    //             dataInView: {
    //                 pro_id: rows[0].pro_id,
    //                 pro_name: rows[0].pro_name,
    //                 seller_id: rows[0].seller_id,
    //                 seller_email: maHoaEmail(rows[0].seller_email),
    //                 seller_point: rows[0].seller_point,
    //                 start_time: rows[0].start_time,
    //                 end_time: rows[0].end_time,
    //                 highest_price: rows[0].highest_price,
    //                 purchase_price: rows[0].purchase_price,
    //                 bidder_id: rows[0].bidder_id,
    //                 bidder_email: maHoaEmail(rows[0].bidder_email),
    //                 bidder_point: rows[0].bidder_point,
    //                 days: tinhThoiGian(rows[0].total_time, 'd'),
    //                 hours: tinhThoiGian(rows[0].total_time, 'h'),
    //                 minutes: tinhThoiGian(rows[0].total_time, 'm'),
    //                 seconds: tinhThoiGian(rows[0].total_time, 's'),
    //                 img01: rows[0].img_path,
    //                 img02: rows[1].img_path,
    //                 img03: rows[2].img_path,
    //             }
    //         }
    //
    //
    //
    //         var vm = {
    //             layoutModels: res.locals.layoutModels,
    //             layout:'main',
    //             product: data,
    //             status_name: 'Chi tiết sản phẩm'
    //         };
    //
    //         res.render('produce/chiTiet', vm);
    //
    //     }).fail(function (err) {
    //     console.log(err);
    //     res.end('fail');
    // });
});

r.get('/chinhsua', function (req, res) {
    if (req.session.isLogged === true) {
        res.render('user/suaThongTinCaNhan', {layout: 'main', layoutModels: res.locals.layoutModels});
    } else {
        res.redirect('/user/dangnhap')
    }

});

var temp;
var storage = multer.diskStorage({
    //duong dan luu file
    destination: function (req, file, cb) {
        try {
            fs.mkdirSync('./data/users/temp');
        } catch (err) {
            if (err.code == 'EEXIST') {
                console.log('thu muc da ton tai');
            } else {
                console.log('Loi.....');
            }
        }
        cb(null, './data/users/temp')
    },
    //ten file luu
    filename: function (req, file, cb) {
        cb(null, 'avatar.jpg');
        temp = 'avatar.jpg';
    }
});

r.post('/chinhsua', multer({storage: storage}).single("avatar"), function (req, res, next) {
    var pass = crypto.createHash('md5').update(req.body.txt_password).digest('hex'),
        user_id = res.locals.layoutModels.curUser.user_id,
        diaChi = req.body.txt_diaChi,
        sdt = req.body.txt_sdt,
        avt = '/users/' + user_id + '/avatar.jpg';
    var entity = {
        name: req.body.txt_hoTen,
        password: pass,
        user_id: user_id,
        diaChi: diaChi,
        sdt: sdt,
        avt: avt
    };

    if (fs.existsSync('./data/users/temp/' + temp)) {
        var readStream = fs.createReadStream('./data/users/temp/' + temp);
        var writeStream = fs.createWriteStream('./data/users/' + user_id + '/' + temp);
        readStream.pipe(writeStream);
        fs.unlinkSync('./data/users/temp/' + temp);
    }

    var _res = res;
    var layoutModels = res.locals.layoutModels;
    userRepo.checkAccountUpdate(entity).then(function (user) {
        if (user == null) {
            _res.render('user/suaThongTinCaNhan', {
                layoutModels: layoutModels,
                layout: 'main',
                showError: true
            });
        } else {
            userRepo.update(entity).then(function (changedRows) {
                _res.render('user/suaThongTinCaNhan',
                    {
                        layoutModels: layoutModels,
                        layout: 'main',
                        showSuccess: true
                    });
            })
        }
    }).fail(function (err) {
        console.log(err);
        res.end('fail');
    });
});

r.get('/doimatkhau', function (req, res) {
    if (req.session.isLogged === true) {
        res.render('user/doiMatKhau', {layout: 'main', layoutModels: res.locals.layoutModels});
    } else {
        res.redirect('/user/dangnhap')
    }
});

r.post('/doimatkhau', function (req, res) {
    var pass = crypto.createHash('md5').update(req.body.txt_password).digest('hex'),
        user_id = res.locals.layoutModels.curUser.user_id,
        passNew = crypto.createHash('md5').update(req.body.txt_passwordNew).digest('hex');
    var entity = {
        passNew: passNew,
        password: pass,
        user_id: user_id
    };

    var _res = res;
    var layoutModels = res.locals.layoutModels;
    userRepo.checkAccountUpdate(entity).then(function (user) {
        if (user == null) {
            _res.render('user/doimatkhau', {
                layoutModels: layoutModels,
                layout: 'main',
                showError: true
            });
        } else {
            userRepo.updatePass(entity).then(function (changedRows) {
                _res.render('user/doimatkhau',
                    {
                        layoutModels: layoutModels,
                        layout: 'main',
                        showSuccess: true
                    });
            })
        }
    }).fail(function (err) {
        console.log(err);
        res.end('fail');
    });
});

// Vào quản lý tin mua (đối tượng người mua)
r.get('/quan-ly-tin-mua', function (req, res) {

    var user_id = res.locals.layoutModels.curUser.user_id;
    var user_email = res.locals.layoutModels.curUser.email;

    q.all([
        userRepo.getBiddingListForUser(user_id),
        userRepo.getFavoriteListForUser(user_id),
        userRepo.getWonListForUser(user_id, user_email),
        userRepo.getProductSellingList(user_id),
        userRepo.getProductSelledList(user_id),
        userRepo.getMarkListForUser(user_id)
    ]).spread(function (r_bidding_list, r_favorite_list, r_history_list, r_selling_list, r_selled_list, r_mark_list) {
        var vm = {
            layout: 'main',
            layoutModels: res.locals.layoutModels,
            bidding_list: r_bidding_list,
            favorite_list: r_favorite_list,
            history_list: r_history_list,
            selling_list: r_selling_list,
            selled_list: r_selled_list,
            mark_list: r_mark_list
        };

        res.render('quanLyTinMua', vm);
    }) //q.all

});

// Vào quản lý tin mua (đánh giá người bán)
r.get('/mark-seller/:id', function (req, res) {

    //lấy id người dùng
    var curUser = res.locals.layoutModels.curUser.user_id;

    //tách id người bán và id sản phẩm
    var value = req.params.id; // sellerId + proId;
    var index_of_At = value.toString().indexOf("+");
    var sellerId = value.substring(0, index_of_At);
    var proId = value.substring(index_of_At+1);

    if(curUser == undefined){
        res.send('Bạn chưa đăng nhập, thao tác không hợp lệ!');
    }else{
        userRepo.checkQuanHeMuaVaBan(proId, curUser, sellerId).then(function(checkVal){
            if(checkVal.result == 0){
                res.send('Lỗi đánh giá: Thao tác không hợp lệ!');
            }else{
                console.log('Vào trang đánh giá!')
                userRepo.getMailByUserId(sellerId, proId).then(function(value){
                    userRepo.getProNameById(proId).then(function(r_pro_name){
                        var vm = {
                            layout: 'main',
                            layoutModels: res.locals.layoutModels,
                            bi_danh_gia_id: sellerId,
                            bi_danh_gia_mail: value.email,
                            pro_id: proId,
                            pro_name: r_pro_name.name,
                            user_type: 'seller'
                        };

                        console.log('check pro name:');
                        console.log(vm);

                        res.render('userMark', vm);
                    })

                })
            }
        })
    }
});

// Vào quản lý tin mua (đánh giá người mua)
r.get('/mark-bidder/:id', function (req, res) {

    //lấy id người dùng
    var curUser = res.locals.layoutModels.curUser.user_id;

    //tách id người bán và id sản phẩm
    var value = req.params.id; // sellerId + proId;
    var index_of_At = value.toString().indexOf("+");
    var bidderId = value.substring(0, index_of_At);
    var proId = value.substring(index_of_At+1);

    if(curUser == undefined){
        res.send('Bạn chưa đăng nhập, thao tác không hợp lệ!');
    }else{
        userRepo.checkQuanHeMuaVaBan(proId, bidderId, curUser).then(function(checkVal){
            if(checkVal.result == 0){
                res.send('Lỗi đánh giá: Thao tác không hợp lệ!');
            }else{
                console.log('Vào trang đánh giá!')
                userRepo.getMailByUserId(bidderId).then(function(value){
                    userRepo.getProNameById(proId).then(function(r_pro_name){
                        var vm = {
                            layout: 'main',
                            layoutModels: res.locals.layoutModels,
                            bi_danh_gia_id: bidderId,
                            bi_danh_gia_mail: value.email,
                            pro_id: proId,
                            pro_name: r_pro_name.name,
                            user_type: 'bidder'
                        };

                        console.log('check pro name:');
                        console.log(vm);

                        res.render('userMark', vm);
                    })
                })
            }
        })
    }
});

r.post('/user-marking', function (req, res) {


    var user_brand; //0 or 1
    var user_type = req.body.txtUserType;
    if(user_type == 'bidder'){
        user_brand = 0;
    }else{ //seller
        user_brand = 1;
    }

    var entity = {
        user_id: req.body.txtUserId,
        user_brand: user_brand,
        marker_id: req.body.txtMarkerId,
        pro_id: req.body.txtProId,
        point: req.body.txtPoint,
        comment: req.body.txtComment,
    };

    console.log('kiểm tra đánh giá người mua:');
    console.log(entity);

    userRepo.insertValueInVoteTable(entity).then(function(){
        var user_id = res.locals.layoutModels.curUser.user_id;
        var user_email = res.locals.layoutModels.curUser.email;

        q.all([
            userRepo.getBiddingListForUser(user_id),
            userRepo.getFavoriteListForUser(user_id),
            userRepo.getWonListForUser(user_id, user_email),
            userRepo.getProductSellingList(user_id),
            userRepo.getProductSelledList(user_id),
            userRepo.getMarkListForUser(user_id)
        ]).spread(function (r_bidding_list, r_favorite_list, r_history_list, r_selling_list, r_selled_list, r_mark_list) {
            var vm = {
                layout: 'main',
                layoutModels: res.locals.layoutModels,
                bidding_list: r_bidding_list,
                favorite_list: r_favorite_list,
                history_list: r_history_list,
                selling_list: r_selling_list,
                selled_list: r_selled_list,
                mark_list: r_mark_list
            };

            res.render('quanLyTinMua', vm);
        }) //q.all
    })

});


module.exports = r;
