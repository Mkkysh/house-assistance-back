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
const multer = require("multer");
const { Console } = require("console");

const parser = new XMLParser();
const jsonParser = express.json();

const PORT = 3000;
const app = express();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(
            null,
            file.originalname.split(".")[0] +
            uniqueSuffix +
            "." +
            file.originalname.split(".")[1]
    );
    },
  });

const upload = multer({ storage: storage });

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


const meetingsScheme = new Schema({
    "name": String,
    "object_id": Array,
    "usres_id": Array,
    "Date": Date
}, {collection: "meetings"});

const ObjectInfo = mongoose.model("objectInfo", objectInfoScheme);

const Meetings = mongoose.model("meetings", meetingsScheme);


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

app.post("/api/user/signup", jsonParser, async (request, response) => {
    let { email, password, name } = request.body;
    existUser = await UserInfo.findOne({email: email});
    if(existUser) response.status(404);
    else{
        let user = await UserInfo.collection.insertOne(request.body)
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
        // fields2 = {
        //     owner_id: false,
        //     factial_user: false
        // }
        let id = new ObjectID(request.params.id);
        let obj = await ObjectInfo.findOne({_id: id});
        fields = {
            name: true,
            picture: true,
            _id: true
        }
       
        let user = await UserInfo.findOne({_id: obj.owner_id}, fields);
        let fact_use = await UserInfo.find({_id: obj.factial_user}, fields);
        obj.owner_id = ''
        obj.factial_user = []
        response.status(200).send({object: obj, owner: user, fact_us: fact_use});
    }
    catch(err){
        console.log(err);
        response.status(404).send("not found");
    }
});

app.get("/api/user/:id", jsonParser, async (request, response) => {
    let id = new mongoose.Types.ObjectId(request.params.id);
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

    let userObjectsFac = await ObjectInfo.find({factial_user: id},fields);
    console.log(userObjectsFac)
    userObjects = [...userObjects, ...userObjectsFac]
    if(!user) response.status(404)
    else response.status(200).send({user: user, objects: userObjects});
});

app.post("/api/newobject", upload.fields([{name: "pics", maxCount: 50}, {name: "files", maxCount: 50}, {name: "imagesStage", maxCount: 50}, {name: "filesStage", maxCount: 50}]), async (request, response) => {

    let imageInfo = JSON.parse(request.body.imagesInfo)    
    var object = JSON.parse(request.body.card);
   
    let owner_name = object.fact_us[0].name;
    let factial_user_name = object.fact_us; 
    factial_user_name = factial_user_name.map(el => el.name);
    
    let owner = await UserInfo.findOne({name: owner_name}, {_id: true});
    let factial_user = await UserInfo.find({name: factial_user_name}); factial_user=factial_user.map(el => el._id)
    let pictures = request.files.pics; pictures = pictures.map(el => el.filename);

    let stageInf = imageInfo.stagesImages;
    let imagesStage = request.files.imagesStage

    let index = 0;
    let offset = 0;
    for(let j=0; j < stageInf.length;j++){
        offset = index;
        index += stageInf[j];
        let photos = [];
        for(let i=offset; i<index;i++){
            photos.push(imagesStage[i].filename);
        }
        object.stages[j].photos = photos;
    }

    let files = request.files.files; files = files.map(el => el.filename);

    let stagefiles = imageInfo.stagesFiles;
    let filesStage = request.files.filesStage

    let indexFile = 0;
    let offsetFile = 0;
    for(let j=0; j < stagefiles.length;j++){
        offsetFile = indexFile;
        indexFile += stagefiles[j];
        let doc = [];
        for(let i=offsetFile; i<indexFile;i++){
            doc.push(filesStage[i].filename);
        }
        object.stages[j].documents = doc;
    }

    let objectIn = {...object, _id: undefined, documents: files, pictures: pictures, owner_id: owner, factial_user: factial_user, owner: undefined, fact_us: undefined};
    delete objectIn._id; delete objectIn.fact_us; delete objectIn.owner;

    await ObjectInfo.collection.insertOne(objectIn);

});

app.put("/api/editobj/:id", jsonParser, async (request, response) => {

    let id = new ObjectID(request.params.id);
    update = request.body.objinf
    let owner_id = request.body.objinf.owner_id;
    let factial_user = request.body.objinf.factial_user;

    if(owner_id) {let owner_id_obj = new mongoose.Types.ObjectId(owner_id); update.owner_id = owner_id_obj;}
    if(factial_user) {let f_u = factial_user.map(elem => new mongoose.Types.ObjectId(elem)); update.factial_user = f_u;}
    update.lastdate = new Date(Date.now())

    let obj = await ObjectInfo.findOneAndUpdate({_id: id}, update, {new: true});
    if(!obj) response.status(404);
    else response.send(obj);
});

app.post("/api/findUser", jsonParser, async (request, response) => {
    let req = `(?i)${request.body.name}(?-i)`;
    let users = await UserInfo.find().regex("name", req);
    if(users) response.send(users);
    else response.status(404);
});

app.post("/api/findObject", jsonParser, async (request, response) => {
    let req = request.body.text;
    let text = req.split(" ").map(el => `(?i)${el}(?-i)`)

    var obj1 = await ObjectInfo.find().regex("district", req)
    var obj2 = await ObjectInfo.find().regex("field", req)

    if(obj1||obj2) response.send([...obj1, ...obj2]);
    else response.status(404);
});

app.post("/api/addMeetinig", jsonParser, async (request, response) => {
    let objects_id = request.body.objects_id; 
    let users_id = request.body.users_id;
    let objects = await ObjectInfo.find({_id: objects_id},{_id: true, factial_user: true});
    if(objects) {
            let users = [];
            objects.forEach(elem => (users.push(...elem.factial_user)));

            users.push(...users_id);
            users.map(elem => new mongoose.Types.ObjectId(elem));
            objects_id.map(elem => new mongoose.Types.ObjectId(elem)) 

            await Meetings.collection.insertOne({...request.body, users_id: users, objects_id: objects_id})

            response.send(users);
        }
    else response.status(404);
});

main();

process.on("SIGINT", async() => {
    await mongoose.disconnect();
    console.log("Приложение завершило работу");
    process.exit();
});