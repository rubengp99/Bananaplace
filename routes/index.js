let express = require('express'),
  morgan = require('morgan'),
  path = require('path'),
  multer = require('multer'),
  moment = require('moment'),
  router = express.Router(),
  fs = require('fs'),
  hash = require('password-hash'),
  { Client } = require('pg'),
  { check, validationResult } = require('express-validator'),
  mailer = require('nodemailer'),
  uploaded = false;

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
  database: 'Products_Ruben',
  password: '12345',
  port: 5432,
});
client.connect();
//-------------- END OF APP CONFIGS --------------------//

//-------------- ROUTES --------------------//

// HOMEPAGE VIEW
router.get('/', (req, res) => {

  //OUR QUERY 
  //"p" STANDS FOR "Products" TABLE, "p_c" STANDS FOR "Products_Category" TABLE
  const query = {
    text: `SELECT p.product_name, p.product_price, p.product_photo, p_c.category_string, p.product_description, p.product_postdate  FROM "public"."Products" p INNER JOIN "public"."Product_Categories" p_c ON p.product_category = p_c.id ORDER BY p.product_postdate DESC`,
    rowMode: 'array'
  }

  client.query(query).then(response => {
    let results = response.rows;
    //CHANGING THE POSTDATE FROM "Ex: Fri 25 2020..." to "Ex: 2 days ago."
    for (let i = 0; i < results.length; i++) {
      results[i][5] = moment(results[i][5], "YYYYMMDD").fromNow();;
    }
    res.render('index', { results });
    res.end();
  })
});

// PRODUCT REGISTER VIEW
router.get('/add_product', (req, res) => {
  res.render('register_product');
});

// CHECK IF USER EXISTS WHILE TYPING ON THE REGISTER FORM
router.post('/check_username', (req, res) => {
  client
    .query(`SELECT * FROM "public"."Users" WHERE user_username = '${req.body.username}'`)
    .then(results =>{
      if(results.rows[0]) 
        res.json({ error: 'The username «'+req.body.username+'» is already taken.'})
      else
        res.json({ success: 'Good, you can take this one.'});
    });
});

// CHECK IF EMAIL EXISTS WHILE TYPING ON THE REGISTER FORM
router.post('/check_email', (req, res) => {
  client
    .query(`SELECT * FROM "public"."Users" WHERE user_email = '${req.body.email}'`)
    .then(results =>{
      if(results.rows[0]) 
        res.json({ error: 'The email «'+req.body.email+'» is already linked to another account.'})
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
    password: hash.generate(req.body.password),
    email: req.body.email,
    phone: req.body.phone,
    direction: req.body.direction,
    photo: 'https://wallpaperplay.com/walls/full/f/e/f/129747.jpg', //The user is not allowed to upload is own on the register form, so its a default
    document: 0,
  }


  //OUR QUERY 
  const query = {
    text: `INSERT INTO "public"."Users" (user_username, user_firstname, user_lastname, user_document, user_document_type, user_email, user_phone, user_direction, user_birthday, user_last_activity, user_password) VALUES ('${user.username}', '${user.fist_name}','${user.last_name}','${user.document}','${user.document}','${user.email}','${user.phone}','${user.direction}',current_timestamp, current_timestamp, '${user.password}')`,
  }

  client
    .query(`SELECT * FROM "public"."Users" WHERE user_username = '${user.username}'`)
    .then(results => {
      if (!results.rows[0]) {
        client
          .query(`SELECT * FROM "public"."Users" WHERE user_email = '${user.email}'`)
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
    text: `SELECT p.product_name, p.product_price, p.product_photo, p_c.category_string, p.product_description, p.product_id, p.product_category FROM "public"."Products" p INNER JOIN "public"."Product_Categories" p_c ON p.product_category = p_c.id ORDER BY p.product_postdate DESC`,
    rowMode: 'array'
  }

  client.query(query).then(response => {
    let results = response.rows;
    res.render('profile', { results });
    res.end();
  })
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
    stock: req.body.product_stock
  };

  //OUR QUERY 
  const query = {
    text: `INSERT INTO "public"."Products"(product_name, product_price, product_category, product_photo, product_description,product_postdate,product_state,product_stock) VALUES('${product.name}', '${product.price}','${product.category}','${product.photo}','${product.description}',current_timestamp,'Available','${product.stock}')`,
  }

  // PROMISE
  client.query(query).then(res => console.log(res.rows[0])).catch(e => console.error(e.stack))

  res.redirect('/');
});

//PRODUCT REMOVE
router.post('/remove_product', (req, res) => {
  const query = {
    text: `DELETE FROM "public"."Products" WHERE product_id = ${req.body.product_id}`,
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
router.post('/update_product', upload.single('product_photo'), (req, res) => {
  let product = {
    id: req.body.product_id,
    name: req.body.product_name,
    price: req.body.product_price,
    description: req.body.product_description,
    category: req.body.product_category,
    photo: 'images/' + file_uploaded,
    stock: req.body.product_stock
  };


  const query = {
    text: `UPDATE "public"."Products" SET product_name = '${product.name}', product_price = '${product.price}', product_category = '${product.category}', product_photo = '${product.photo}', product_description = '${product.description}', product_postdate = current_timestamp, product_state = 'Available', product_stock = '${product.stock}' WHERE product_id = ${product.id}`,
  }
  // PROMISE
  client.query(query).catch(e => console.error(e.stack));
  if (uploaded === true) {

    let updated = true;
    fs.unlink(path.join(__dirname, '../') + 'public/' + req.body.old_photo,
      (err) => { //res.json({ error: "ERROR! THIS PRODUCT CAN'T BE UPDATED"}); 
        updated = false;
        console.log(err);
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


//-------------- END OF ROUTES --------------------//

module.exports = router;
