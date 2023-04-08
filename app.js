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
	"space": Number,
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

    if(type) filter.type = type; if(district) filter.district = district;
    if(field) filter.field = field; if(status) filter.status = status;
    if(maxArea||minArea)
        filter.$and = []
    if(maxArea) filter.$and.push({space: {$lte: maxArea}}); if(minArea) filter.$and.push({space: {$gte: minArea}}) 

    console.log(filter);


    let objs = {}
    if (sort && sortDirection)
        objs = await ObjectInfo.find(filter).sort({sort: sortDirection})
    else 
        objs = await ObjectInfo.find(filter); 

    

    response.send(objs);
});

main();