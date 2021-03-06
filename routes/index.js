let express = require('express'),
  morgan = require('morgan'),
  path = require('path'),
  multer = require('multer'),
  moment = require('moment'),
  router = express.Router(),
  fs = require('fs'),
  hash = require('bcrypt'),
  { Client } = require('pg'),
  { check, validationResult } = require('express-validator'),
  mailer = require('nodemailer'),
  uploaded = false,
  file_uploaded;
const salt = hash.genSaltSync(10);

//-------------- APP CONFIGS --------------------//
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(morgan('dev'));

// PATH FOR STORING IMAGES
let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/images')
  },
  filename: (req, file, cb) => {
    file_uploaded = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
    cb(null, file_uploaded);
    uploaded = true;
  }
});

// INITIALIZATION OF MULTER LIB
const upload = multer({
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
  storage: storage
});

//POSTGRESQL INITIALIZATION
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'products_ruben',
  password: '12345',
  port: 5432,
});
client.connect();
//-------------- END OF APP CONFIGS --------------------//

//-------------- ROUTES --------------------//

// HOMEPAGE VIEW
router.get('/', (req, res) => {

  //OUR QUERY 
  //"p" STANDS FOR "products" TABLE, "p_c" STANDS FOR "products_Category" TABLE
  const query = {
    text: `SELECT p.product_name, p.product_price, p.product_photo, p_c.category_string, p.product_description, p.product_postdate  FROM "products" p INNER JOIN product_categories p_c ON p.product_category = p_c.category_id ORDER BY p.product_postdate DESC`,
    rowMode: 'array'
  }

  client.query(query).then(response => {
    let results = response.rows;
    //CHANGING THE POSTDATE FROM "Ex: Fri 25 2020..." to "Ex: 2 days ago."
    for (const result of results) {
      result[5] = moment(result[5], "YYYYMMDD").fromNow();
    }
    res.render('index', { results });
    res.end();
  }).catch(e => console.error(e.getStack()));
});

// PRODUCT REGISTER VIEW
router.get('/add_product', (req, res) => {
  res.render('register_product');
});

// CHECK IF USER EXISTS WHILE TYPING ON THE REGISTER FORM
router.post('/check_username', (req, res) => {
  client
    .query(`SELECT * FROM "users" WHERE user_username = '${req.body.username}'`)
    .then(results =>{
      if(results.rows[0]) 
        res.json({ error: '«'+req.body.username+'» is already taken.'})
      else
        res.json({ success: 'Good, you can take this one.'});
    });
});

// CHECK IF EMAIL EXISTS WHILE TYPING ON THE REGISTER FORM
router.post('/check_email', (req, res) => {
  client
    .query(`SELECT * FROM "users" WHERE user_email = '${req.body.email}'`)
    .then(results =>{
      if(results.rows[0]) 
        res.json({ error: '«'+req.body.email+'» is already linked to another account.'})
      else
        res.json({ success: 'This email is okay.'});
    });
});

// PRODUCT REGISTER VIEW
router.post('/add_user', (req, res) => {
  let response = {};
  let user = {
    fist_name: req.body.first_name,
    last_name: req.body.last_name,
    username: req.body.username,
    password: hash.hashSync(req.body.password,salt),
    email: req.body.email,
    phone: req.body.phone,
    direction: req.body.direction,
    photo: 'https://wallpaperplay.com/walls/full/f/e/f/129747.jpg', //The user is not allowed to upload is own on the register form, so its a default
    document: 0,
  }


  //OUR QUERY 
  const query = {
    text: `INSERT INTO "users" (user_username, user_firstname, user_lastname, user_document, user_document_type, user_email, user_phone, user_direction, user_birthday, user_last_activity, user_password) VALUES ('${user.username}', '${user.fist_name}','${user.last_name}','${user.document}','${user.document}','${user.email}','${user.phone}','${user.direction}',current_timestamp, current_timestamp, '${user.password}')`,
  }

  client
    .query(`SELECT * FROM "users" WHERE user_username = '${user.username}'`)
    .then(results => {
      if (!results.rows[0]) {
        client
          .query(`SELECT * FROM "users" WHERE user_email = '${user.email}'`)
          .then(results => {
            if (!results.rows[0]) {
              client.query(query)
                .then(results => {
                  res.json({ success: 'Your account has been created. Lets sign in!'});
                });
            } else {
              res.json({ error: 'The email "' + user.email + '" is already in use.'});
            }
          });
      } else {
        res.json({ error: 'The username "<strong>' + user.username + '</strong>" is already taken.'});
      }  
    });



});

// USER REGISTER VIEW
router.get('/sign_in', (req, res) => {
  res.render('signIn_signUp');
});


router.get('/profile', (req, res) => {
  const query = {
    text: `SELECT p.product_name, p.product_price, p.product_photo, p_c.category_string, p.product_description, p.product_id, p.product_category FROM "products" p INNER JOIN product_categories p_c ON p.product_category = p_c.category_id ORDER BY p.product_postdate DESC`,
    rowMode: 'array'
  }

  client.query(query).then(response => {
    let results = response.rows;
    res.render('profile', { results });
    res.end();
  }).catch(e => console.log(e));
});

// SERVER SIDE PRODUCT REGISTER ROUTE
router.post('/add_product', upload.single('product_photo'), (req, res) => {

  // PRODUCT ADDED
  let product = {
    name: req.body.product_name,
    price: req.body.product_price,
    description: req.body.product_description,
    category: req.body.product_category,
    photo: 'images/' + file_uploaded,
    state: 0,
    stock: req.body.product_stock
  };

  //OUR QUERY 
  const query = {
    text: `INSERT INTO products (product_name, product_price, product_category, product_photo, product_description,product_postdate,product_state,product_stock) VALUES('${product.name}', '${product.price}','${product.category}','${product.photo}','${product.description}',current_timestamp,'${product.state}','${product.stock}')`,
  }

  // PROMISE
  client.query(query).then(res => console.log(res.rows[0])).catch(e => console.log(e))

  res.redirect('/');
});

//PRODUCT REMOVE
router.post('/remove_product', (req, res) => {
  const query = {
    text: `DELETE FROM "products" WHERE product_id = ${req.body.product_id}`,
  }
  // PROMISE
  client.query(query);
  fs.unlink(path.join(__dirname, '../') + 'public/' + req.body.photo, (err) => {
    if (err) {
      res.json({ success: "AN ERROR OCURRED, PLEASE RELOAD THE PAGE!", status: 404, request: 'DELETE' })
    } else {
      res.json({ success: "PRODUCT DELETED!", status: 200, request: 'DELETE' })
    }
  });
});

//PRODUCT UPDATE
router.post('/update_product', (req, res) => {
  res;
  let e = req.body;
  res.json({success: "ewe", s: e});

  client.query(`SELECT * FROM products WHERE product_id = ${req.body.product_id}`).then(r =>{
    if (r.rows[0])
      if(!r.rows[0].product_photo === req.body.product_photo)
        upload.single(req.body.product_photo)
  })
  let product = {
    id: req.body.product_id,
    name: req.body.product_name,
    price: req.body.product_price,
    description: req.body.product_description,
    category: req.body.product_category,
    photo: 'images/' + file_uploaded,
    stock: req.body.product_stock,
    state: 0,
  };
  
  
  const query = {
    text: `UPDATE products SET product_name = '${product.name}', product_price = '${product.price}', product_category = '${product.category}', product_photo = '${product.photo}', product_description = '${product.description}', product_postdate = current_timestamp, product_stock = '${product.stock}' WHERE product_id = ${product.id}`,
  }
  // PROMISE
  client.query(query).catch(e => console.error(e.stack));
  if (uploaded === true) {

    let updated = true;
    fs.unlink(path.join(__dirname, '../') + 'public/' + req.body.old_photo,
      (err) => { //res.json({ error: "ERROR! THIS PRODUCT CAN'T BE UPDATED"}); 
        updated = false;
      });

    uploaded = false;

    if (updated) {
      res.json({ success: "PRODUCT UPDATED!", photo: "images/" + file_uploaded });
      res.end();
    }

  }
});

// SEND MAIL 
router.get('/password_recover', (req, res) => {

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'no.reply.rubenprojects@gmail.com',
      pass: '12312311xD'
    }
  });
  let mailOptions = {
    from: 'no-reply@rubengp99.com',
    to: req.body.mail,
    subject: 'Sending Email using Node.js',
    text: 'That was easy!'
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  }); 

});

// CHECK IF USER EXISTS WHILE TYPING ON THE REGISTER FORM
router.post('/login', (req, res) => {  
  client
    .query(`SELECT * FROM "users" WHERE user_username = '${req.body.username}'`)
    .then(results =>{
      if(!results.rows[0]) 
        res.json({ error: "This username isn't registered."})
      else
        if (hash.compareSync(req.body.password, results.rows[0].user_password)){
          res.json({ success: 'You logged in succesfully.'});
        }else
          res.json({ error: "These credentials doesn't match with our records."})
    });
});

//-------------- END OF ROUTES --------------------//

module.exports = router;
