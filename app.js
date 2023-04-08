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
const test = 0;

const objectInfoScheme = new Schema({
    "lastdate": Date,
    "firstdate": Date,
	"name": String,
	"field": String,
	"district": String,
	"address": String,
	"type": String,
	"area": Number,
	"owner_id": String,
	"factial_user": String,
	"pictures": Array,
	"documents": Array,
	"desc": String,
	"responsibles": Array,
	"status": String,
	"stages":
	{
		"documents": Array,
		"photos": Array,
		"name": String,
		"desc": String,
		"limit_date": Date,
		"current_date": Date,
		"status": String,
		"responsibles": String
	}
}, {collection: "objectInfo"});

const userInfo = new Schema({
    "id": Number,
	"picture": String,
	"contacts": Array,
	"email": String,
	"desc": String,
	"name": String,
	"id_pr": Array,
	"password": String
}, {collection: "userInfo"})

const ObjectInfo = mongoose.model("objectInfo", objectInfoScheme);
const UserInfo =  mongoose.model("userInfo", userInfo);

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

    let countPage = objs.length/count_objs + 1;

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
        let id = new ObjectID(request.params.id);
        let obj = await ObjectInfo.find({_id: id});
        response.status(200).send(obj);
    }
    catch(err){
        console.log(err);
        response.status(404).send("not found");
    }
});

app.post("/api/newobject", jsonParser, async (request, response) => {

    /*let obj = new UserInfo(request.body.objinf)
    obj.save((err)=>{
        if (err) response.status(404); 
    })
    
    response.send(request.body.objinf);
    */

});


main();

process.on("SIGINT", async() => {
    await mongoose.disconnect();
    console.log("Приложение завершило работу");
    process.exit();
});