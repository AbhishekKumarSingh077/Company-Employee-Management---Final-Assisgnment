/*********************************************************************************
* WEB322 – Assignment 06
* I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part
* of this assignment has been copied manually or electronically from any other source
* (including 3rd party web sites) or distributed to other students.
*
* Name: ABHISHEK KUMAR SINGH Student ID: 133410209 Date: 04-12-2021
*
* Online (Heroku) Link: 
*
********************************************************************************/

const express = require("express");
const path = require("path");
const data = require("./data-service.js");
const bodyParser = require('body-parser');
const fs = require("fs");
const multer = require("multer");
var clientSessions = require("client-sessions");
const exphbs = require('express-handlebars');
const app = express();
var dataServiceAuth = require('./data-service-auth.js');

const HTTP_PORT = process.env.PORT || 8080;

app.engine('.hbs', exphbs({ 
    extname: '.hbs',
    defaultLayout: "main",
    helpers: { 
        navLink: function(url, options){
            return '<li' + 
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') + 
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    } 
}));

app.set('view engine', '.hbs');

const storage = multer.diskStorage({
    destination: "./public/images/uploaded",
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  
  const upload = multer({ storage: storage });


app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(clientSessions({
    cookieName: "session", 
    secret: "web322_assignment6",
    duration: 2 * 60 * 1000, // 2minutes
    activeDuration: 1000 * 60 
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});  

let ensureLogin = (req, res, next) => {
    if(!req.session.user){
        res.redirect("/login");
    } else {
        next();
    }
};

app.use(function(req,res,next){
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.get("/", (req,res) => {
    res.render("home");
});

app.get("/about", (req,res) => {
    res.render("about");
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/logout', (req, res) => {
    req.session.reset();
    res.redirect('/');
});

app.get('/userHistory', ensureLogin, (req, res) => {
    res.render('userHistory');
});

app.get("/images/add", ensureLogin, (req,res) => {
    res.render("addImage");
});

app.get("/employees/add", ensureLogin, (req,res) => {

    data.getDepartments().then((data)=>{
        res.render("addEmployee", {departments: data});
     }).catch((err) => {
       res.render("addEmployee", {departments: [] });
    });
  
  
  });

app.get("/images", ensureLogin, (req,res) => {
    fs.readdir("./public/images/uploaded", function(err, items) {
        res.render("images",{images:items});
    });
});

app.get("/employees", ensureLogin, (req, res) => {
    
   if (req.query.status) {
        data.getEmployeesByStatus(req.query.status).then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    } else if (req.query.department) {
        data.getEmployeesByDepartment(req.query.department).then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    } else if (req.query.manager) {
        data.getEmployeesByManager(req.query.manager).then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    } else {
        data.getAllEmployees().then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    }
});

app.get("/employee/:empNum", ensureLogin, (req, res) => {
    let viewData = {};

    data.getEmployeeByNum(req.params.empNum).then((data) => {
        if (data) {
            viewData.employee = data; 
        } else {
            viewData.employee = null; 
        }
    }).catch(() => {
        viewData.employee = null;  
    }).then(data.getDepartments)
    .then((data) => {
        viewData.departments = data; 


        for (let i = 0; i < viewData.departments.length; i++) {
            if (viewData.departments[i].departmentId == viewData.employee.department) {
                viewData.departments[i].selected = true;
            }
        }

    }).catch(() => {
        viewData.departments = []; 
    }).then(() => {
        if (viewData.employee == null) { 
            res.status(404).send("Employee Not Found");
        } else {
            res.render("employee", { viewData: viewData }); 
        }
    }).catch((err)=>{
        res.status(500).send("Unable to Show Employees");
      });;
});



app.get("/departments", ensureLogin, (req,res) => {
    data.getDepartments().then((data)=>{
        res.render("departments", (data.length > 0) ? {departments:data} : { message: "no results" });
    }).catch((err) => {
        res.render("departments",{message:"no results"});
    });
});

app.post('/register', (req, res) => {
    dataServiceAuth.registerUser(req.body)
    .then((value) => {
        res.render('register', {successMessage: "User created"});
    }).catch((err) => {
        res.render('register', {errorMessage: err, userName: req.body.userName});
    })
});

app.post('/login', (req, res) => {
    req.body.userAgent = req.get('User-Agent');

    dataServiceAuth.checkUser(req.body)
    .then((user) => {
        req.session.user = {
            userName: user.userName,
            email: user.email,
            loginHistory: user.loginHistory
        }
        res.redirect('/employees');
    }).catch((err) => {
        res.render('login', {errorMessage: err, userName: req.body.userName});
    });
});


app.post("/employees/add", ensureLogin, (req, res) => {
    data.addEmployee(req.body).then(()=>{
      res.redirect("/employees"); 
    }).catch((err)=>{
        res.status(500).send("Unable to Add the Employee");
      });
  });

app.post("/images/add", upload.single("imageFile"), ensureLogin, (req,res) =>{
    res.redirect("/images");
});


app.post("/employee/update", ensureLogin, (req, res) => {
    data.updateEmployee(req.body).then(()=>{
    res.redirect("/employees");
  }).catch((err)=>{
    res.status(500).send("Unable to Update the Employee");
  });
  
});

app.get("/departments/add", ensureLogin, (req,res) => {
    res.render("addDepartment");
  });
  
  app.post("/departments/add", ensureLogin, (req, res) => {
    data.addDepartment(req.body).then(()=>{
      res.redirect("/departments");
    }).catch((err)=>{
        res.status(500).send("Unable to Add the Department");
      });
  });
  

  app.post("/department/update", ensureLogin, (req, res) => {
      data.updateDepartment(req.body).then(()=>{
      res.redirect("/departments");
    }).catch((err)=>{
        res.status(500).send("Unable to Update the Department");
    });
    
  });
  
  app.get("/department/:departmentId", ensureLogin, (req, res) => {
  
    data.getDepartmentById(req.params.departmentId).then((data) => {
        if(data){
            res.render("department", { data: data });
        }else{
            res.status(404).send("Department Not Found");
        }
     
    }).catch((err) => {
      res.status(404).send("Department Not Found");
    });
  
  });

  app.get("/employees/delete/:empNum", ensureLogin, (req,res)=>{
    data.deleteEmployeeByNum(req.params.empNum).then(()=>{
      res.redirect("/employees");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Employee / Employee Not Found");
    });
  });

  app.get("/departments/delete/:depId", ensureLogin, (req,res)=>{
    data.deleteDepartmentById(req.params.depId).then(()=>{
      res.redirect("/departments");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Department / Department Not Found");
    });
  });

app.use((req, res) => {
    res.status(404).send("Page Not Found");
  });

data.initialize()
    .then(dataServiceAuth.initialize)
    .then(function () {
        app.listen(HTTP_PORT, function () {
            console.log("app listening on: " + HTTP_PORT)
        });
    }).catch(function (err) {
        console.log("unable to start server: " + err);
    });