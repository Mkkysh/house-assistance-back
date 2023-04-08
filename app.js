const express = require("express");
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");
const fs = require("fs")
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Schema = mongoose.Schema;
const MongoClient = require("mongodb").MongoClient;

const parser = new XMLParser();
const jsonParser = express.json();

const PORT = 3000;
const app = express();

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

app.post("/api/index/page", jsonParser, async (request, response) => {
    let { page, sort, sortDirection, status, field, district, type, maxArea, minArea} = request.body;
    page = !page ? 0 : page;

    let filter = {}
    let sorter = {}

    if(type) filter.type = type; if(district) filter.district = district;
    if(field) filter.field = field; if(status) filter.status = status;
    if(maxArea||minArea)
        filter.$and = []
    if(maxArea) filter.$and.push({area: {$lte: maxArea}}); if(minArea) filter.$and.push({area: {$gte: minArea}}) 

    let objs = {}

    if (sort && (sortDirection!==undefined)){
        sorter[`${sort}`] = sortDirection
        objs = await ObjectInfo.find(filter).sort(sorter).skip(page*2).limit(2);
    }
    else 
        objs = await ObjectInfo.find(filter).skip(page*2).limit(2); 

    response.send(objs);
});

app.post("/api/page", jsonParser, async (request, response) => {
    let { page, sort, sortDirection, status, field, district, type, maxArea, minArea} = request.body;
    page = !page ? 0 : page;

    let filter = {}
    let sorter = {}

    if(type) filter.type = type; if(district) filter.district = district;
    if(field) filter.field = field; if(status) filter.status = status;
    if(maxArea||minArea)
        filter.$and = []
    if(maxArea) filter.$and.push({area: {$lte: maxArea}}); if(minArea) filter.$and.push({area: {$gte: minArea}}) 

    let objs = {}

    if (sort && (sortDirection!==undefined)){
        sorter[`${sort}`] = sortDirection
        objs = await ObjectInfo.find(filter).sort(sorter).skip(page*2).limit(2);
    }
    else 
        objs = await ObjectInfo.find(filter).skip(page*2).limit(2); 

    response.send(objs);
});

app.get("/api/filter", jsonParser, async (request, response) => {
    let obj = await ObjectInfo.find()


    let filters = {
        type: [...new Set(obj.map(item => item.type))],
        status: [...new Set(obj.map(item => item.status))],
        district: [...new Set(obj.map(item => item.district))],
        field: [...new Set(obj.map(item => item.field))],
        maxArea: Math.max(...new Set(obj.map(item => item.area))),
        minArea: Math.min(...new Set(obj.map(item => item.area)))
    }

    response.send(filters)
    
});

main();

process.on("SIGINT", async() => {
      
    await mongoose.disconnect();
    console.log("Приложение завершило работу");
    process.exit();
});