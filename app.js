const express = require("express");
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");
const fs = require("fs")
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { ObjectID } = require("bson");
const { object } = require("webidl-conversions");
const Schema = mongoose.Schema;
const MongoClient = require("mongodb").MongoClient;

const parser = new XMLParser();
const jsonParser = express.json();

const PORT = 3000;
const app = express();

const userInfo = new Schema({
	"picture": String,
	"contacts": Array,
	"email": String,
	"desc": String,
	"name": String,
	"id_pr": Array,
	"password": String
}, {collection: "userInfo"})

const UserInfo =  mongoose.model("userInfo", userInfo);

const objectInfoScheme = new Schema({
    "lastdate": Date,
    "firstdate": Date,
	"name": String,
	"field": String,
	"district": String,
	"address": String,
	"type": String,
	"area": Number,
	"owner_id": Schema.ObjectId,
	"factial_user": Array,
	"pictures": Array,
	"documents": Array,
	"desc": String,
	"status": String,
	"stages": Array
	// {
	// 	"documents": Array,
	// 	"photos": Array,
	// 	"name": String,
	// 	"desc": String,
	// 	"limit_date": Date,
	// 	"current_date": Date,
	// 	"status": String,
	// 	"responsibles": String
	// }
}, {collection: "objectInfo"});


const ObjectInfo = mongoose.model("objectInfo", objectInfoScheme);


async function main() {
 
    try{
        await mongoose.connect("mongodb://127.0.0.1:27017/database-house-assistance");
        app.listen(3000);
        console.log("Сервер ожидает подключения...");
    }
    catch(err) {
        return console.log(err);
    }
}

app.post("/api/user/login", jsonParser, async (request, response) => {
    let { email, password } = request.body;
     const user = await UserInfo.findOne({email: email, password: password});
     if(user){
        const code = jwt.sign(
          { login: email },
          "MIREAfan",
          { expiresIn: 24 * 60 * 60 },
          (err, token) => {
            response.status(200).send({ key: token });
          }
        );
      } else {
        response.status(404).send({ key: undefined });
      }
});

app.post("/api/page", jsonParser, async (request, response) => {
    let { page, sort, sortDirection, status, field, district, type, maxArea, minArea} = request.body;
    page = !page ? 0 : page;
    const count_objs = 20;

    let filter = {};
    let sorter = {};

    if(type) filter.type = type; if(district) filter.district = district;
    if(field) filter.field = field; if(status) filter.status = status;
    if(maxArea||minArea)
        filter.$and = [];
    if(maxArea) filter.$and.push({area: {$lte: maxArea}}); if(minArea) filter.$and.push({area: {$gte: minArea}});

    let fields = {
        address: true,
        status: true,
        type: true,
        area: true,
        field: true,
        pictures: {$slice: 1}
    }

    let objs = {}

    if (sort && (sortDirection!==undefined)){
        sorter[`${sort}`] = sortDirection;
        objs = await ObjectInfo.find(filter, fields).sort(sorter).skip(page*count_objs).limit(count_objs);
    }
    else 
        objs = await ObjectInfo.find(filter, fields).skip(page*count_objs).limit(count_objs); 

    let countPage = Math.ceil(objs.length/count_objs);

    response.send({objects: objs, pages: countPage});
});

app.get("/api/filter", jsonParser, async (request, response) => {
    let obj = await ObjectInfo.find();


    let filters = {
        type: [...new Set(obj.map(item => item.type))],
        status: [...new Set(obj.map(item => item.status))],
        district: [...new Set(obj.map(item => item.district))],
        field: [...new Set(obj.map(item => item.field))],
        maxArea: Math.max(...new Set(obj.map(item => item.area))),
        minArea: Math.min(...new Set(obj.map(item => item.area)))
    }

    response.send(filters);
    
});

app.get("/api/object/:id", jsonParser, async (request, response) => {
    try {
        fields2 = {
            owner_id: false,
            factial_user: false
        }
        let id = new ObjectID(request.params.id);
        let obj = await ObjectInfo.findOne({_id: id}, fields2);
        fields = {
            name: true,
            picture: true,
            _id: true
        }
       
        let user = await UserInfo.findOne({_id: obj.owner_id}, fields);
        let fact_use = await UserInfo.find({_id: obj.factial_user}, fields);
        response.status(200).send({object: obj, owner: user, fact_us: fact_use});
    }
    catch(err){
        response.status(404).send("not found");
    }
});

app.get("/api/user/:id", jsonParser, async (request, response) => {
    let id = new ObjectID(request.params.id);
    let userFilter = {password: false}
    let user = await UserInfo.findById(id, userFilter);
    let fields = {
        address: true,
        status: true,
        type: true,
        area: true,
        field: true,
        pictures: {$slice: 1}
    }
    let userObjects = await ObjectInfo.find({owner_id: id}, fields);
    if(!user) response.status(404)
    else response.status(200).send({user: user, objects: userObjects});
});

app.post("/api/newobject", jsonParser, async (request, response) => {

    let owner_id = request.body.objinf.owner_id;
    let factial_user = request.body.objinf.factial_user

    let owner = await UserInfo.findById(request.body.objinf.owner_id)
    if(!owner) response.status(404)

    let factial_users = await UserInfo.find({_id: request.body.objinf.factial_user});
    if(!factial_users) response.status(404)

    console.log(new ObjectID(owner_id))

    let obj = new mongoose.Types.ObjectId(owner_id)
    let f_u = factial_user.map(elem => new mongoose.Types.ObjectId(elem))
    await ObjectInfo.collection.insertOne({...request.body.objinf, firstdate: new Date(Date.now()), 
        lastdate:new Date(Date.now()), owner_id: obj, factial_user: f_u});
    
});

app.put("/api/editobj/:id", jsonParser, async (request, response) => {

    let id = new ObjectID(request.params.id);
    update = request.body.objinf
    let owner_id = request.body.objinf.owner_id;
    let factial_user = request.body.objinf.factial_user

    if(owner_id) {let owner_id_obj = new mongoose.Types.ObjectId(owner_id); update.owner_id = owner_id_obj;}
    if(factial_user) {let f_u = factial_user.map(elem => new mongoose.Types.ObjectId(elem)); update.factial_user = f_u;}

    let obj = await ObjectInfo.findOneAndUpdate({_id: id}, update, {new: true})
    if(!obj) response.status(404)
    else response.send(obj)
});

app.get("/api/findUser", jsonParser, async (request, response) => {
    let req = `(?i)${request.body.name}(?-i)`;
    console.log(req)
    let filter = {name: {$regex: req}};
    let users = await UserInfo.find().regex("name", req)
    response.send(users)
});

main();

process.on("SIGINT", async() => {
    await mongoose.disconnect();
    console.log("Приложение завершило работу");
    process.exit();
});