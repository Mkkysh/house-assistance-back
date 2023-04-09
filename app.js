const express = require("express");
const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { ObjectID } = require("bson");
const { object } = require("webidl-conversions");
const Schema = mongoose.Schema;
const MongoClient = require("mongodb").MongoClient;
const multer = require("multer");
const { Console } = require("console");
const { captureRejectionSymbol } = require("events");
const cors = require("cors");

const parser = new XMLParser();
const jsonParser = express.json();

const PORT = 3000;
const app = express();

app.use(cors());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
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

const userInfo = new Schema(
  {
    picture: String,
    contacts: Array,
    email: String,
    desc: String,
    name: String,
    id_pr: Array,
    password: String,
  },
  { collection: "userInfo" }
);

const UserInfo = mongoose.model("userInfo", userInfo);

const objectInfoScheme = new Schema(
  {
    lastdate: Date,
    firstdate: Date,
    name: String,
    field: String,
    district: String,
    address: String,
    type: String,
    area: Number,
    owner_id: Schema.ObjectId,
    factial_user: Array,
    pictures: Array,
    documents: Array,
    desc: String,
    status: String,
    stages: Array,
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
  },
  { collection: "objectInfo" }
);

const meetingsScheme = new Schema(
  {
    name: String,
    objects_id: Array,
    users_id: Array,
    Date: Date,
    status: String,
    result: String,
  },
  { collection: "meetings" }
);

const ObjectInfo = mongoose.model("objectInfo", objectInfoScheme);

const Meetings = mongoose.model("meetings", meetingsScheme);

async function main() {
  try {
    await mongoose.connect(
      "mongodb://127.0.0.1:27017/database-house-assistance"
    );
    app.listen(3000);
    console.log("Сервер ожидает подключения...");
  } catch (err) {
    return console.log(err);
  }
}

app.post("/api/user/login", jsonParser, async (request, response) => {
  let { email, password } = request.body;
  const user = await UserInfo.findOne({ email: email, password: password });
  if (user) {
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
  existUser = await UserInfo.findOne({ email: email });
  if (existUser) response.status(404);
  else {
    let user = await UserInfo.collection.insertOne(request.body);
    if (user) {
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

app.post("/api/page", verfyToken, jsonParser, async (request, response) => {
  try {
    let {
      page,
      sort,
      sortDirection,
      status,
      field,
      district,
      type,
      maxArea,
      minArea,
      address,
    } = request.body;
    page = !page ? 0 : page;
    const count_objs = 20;

    let filter = {};
    let sorter = {};

    if (type) filter.type = type;
    if (district) filter.district = district;
    if (field) filter.field = field;
    if (status) filter.status = status;

    let reg = `(?i)${address}(?-i)`;

    if (maxArea || minArea) filter.$and = [];
    if (maxArea) filter.$and.push({ area: { $lte: maxArea } });
    if (minArea) filter.$and.push({ area: { $gte: minArea } });

    let fields = {
      address: true,
      status: true,
      type: true,
      area: true,
      field: true,
      pictures: { $slice: 1 },
    };

    let objs = {};

    if (sort && sortDirection !== undefined) {
      sorter[`${sort}`] = sortDirection;
      if (address)
        objs = await ObjectInfo.find(filter, fields)
          .regex("address", reg)
          .sort(sorter)
          .skip(page * count_objs)
          .limit(count_objs);
      else
        objs = await ObjectInfo.find(filter, fields)
          .sort(sorter)
          .skip(page * count_objs)
          .limit(count_objs);
    } else if (address)
      objs = await ObjectInfo.find(filter, fields)
        .regex("address", reg)
        .skip(page * count_objs)
        .limit(count_objs);
    else
      objs = await ObjectInfo.find(filter, fields)
        .skip(page * count_objs)
        .limit(count_objs);

    let count = 0;
    if (address) count = await ObjectInfo.count(filter).regex("address", reg);
    else count = await ObjectInfo.count(filter);

    let countPage = Math.ceil(count / count_objs);

    response.send({ objects: objs, pages: countPage });
  } catch (err) {
    console.log(err);
    response.status(404).send({ key: undefined });
  }
});

app.get("/api/filter", verfyToken, jsonParser, async (request, response) => {
  let obj = await ObjectInfo.find();

  let filters = {
    type: [...new Set(obj.map((item) => item.type))],
    status: [...new Set(obj.map((item) => item.status))],
    district: [...new Set(obj.map((item) => item.district))],
    field: [...new Set(obj.map((item) => item.field))],
    maxArea: Math.max(...new Set(obj.map((item) => item.area))),
    minArea: Math.min(...new Set(obj.map((item) => item.area))),
  };

  response.send(filters);
});

app.get(
  "/api/object/:id",
  verfyToken,
  jsonParser,
  async (request, response) => {
    try {
      // fields2 = {
      //     owner_id: false,
      //     factial_user: false
      // }
      let id = new ObjectID(request.params.id);
      let obj = await ObjectInfo.findOne({ _id: id });
      fields = {
        name: true,
        picture: true,
        _id: true,
      };

      let user = await UserInfo.findOne({ _id: obj.owner_id }, fields);
      let fact_use = await UserInfo.find({ _id: obj.factial_user }, fields);
      obj.owner_id = "";
      obj.factial_user = [];
      response
        .status(200)
        .send({ object: obj, owner: user, fact_us: fact_use });
    } catch (err) {
      console.log(err);
      response.status(404).send("not found");
    }
  }
);

app.get("/api/user/:id", verfyToken, jsonParser, async (request, response) => {
  let id = request.params.id;

  if (id != "0") id = new mongoose.Types.ObjectId(request.params.id);
  else id = response.locals.id;

  let userFilter = { password: false };
  let user = await UserInfo.findById(id, userFilter);
  let fields = {
    address: true,
    status: true,
    type: true,
    area: true,
    field: true,
    pictures: { $slice: 1 },
  };
  let userObjects = await ObjectInfo.find({ owner_id: id }, fields);

  let userObjectsFac = await ObjectInfo.find({ factial_user: id }, fields);
  console.log(userObjectsFac);
  userObjects = [...userObjects, ...userObjectsFac];
  if (!user) response.status(404);
  else response.status(200).send({ user: user, objects: userObjects });
});

app.post(
  "/api/newobject",
  verfyToken,
  upload.fields([
    { name: "pics", maxCount: 50 },
    { name: "files", maxCount: 50 },
    { name: "imagesStage", maxCount: 50 },
    { name: "filesStage", maxCount: 50 },
  ]),
  async (request, response) => {
    try {
      let imageInfo = JSON.parse(request.body.imagesInfo);
      var object = JSON.parse(request.body.card);

      let owner_name = object.fact_us[0].name;
      let factial_user_name = object.fact_us;
      factial_user_name = factial_user_name.map((el) => el.name);

      let owner = await UserInfo.findOne({ name: owner_name }, { _id: true });
      // if(!owner){
      //   await 
      // }

      let factial_user = await UserInfo.find({ name: factial_user_name });
      factial_user = factial_user.map((el) => el._id);

      let pictures = request.files.pics;
      pictures = pictures.map((el) => el.filename);

      let stageInf = imageInfo.stagesImages;
      let imagesStage = request.files.imagesStage;

      let index = 0;
      let offset = 0;
      for (let j = 0; j < stageInf.length; j++) {
        offset = index;
        index += stageInf[j];
        let photos = [];
        for (let i = offset; i < index; i++) {
          photos.push(imagesStage[i].filename);
        }
        object.stages[j].photos = photos;
      }

      console.log(request.files);

      let files = request.files.files;
      files = files.map((el) => {
        return {
          path: el.filename,
          exts: el.filename.substring(el.filename.indexOf(".") + 1),
          name: el.originalname.substring(0, el.originalname.indexOf(".")),
        };
      });

      let stagefiles = imageInfo.stagesFiles;
      let filesStage = request.files.filesStage;

      let indexFile = 0;
      let offsetFile = 0;
      for (let j = 0; j < stagefiles.length; j++) {
        offsetFile = indexFile;
        indexFile += stagefiles[j];
        let doc = [];
        for (let i = offsetFile; i < indexFile; i++) {
          doc.push({
            path: filesStage[i].filename,
            exts: filesStage[i].filename.substring(
              filesStage[i].filename.indexOf(".") + 1
            ),
            name: filesStage[i].originalname.substring(
              0,
              filesStage[i].originalname.indexOf(".")
            ),
          });
        }
        object.stages[j].documents = doc;
      }

      let objectIn = {
        ...object,
        _id: undefined,
        documents: files,
        pictures: pictures,
        owner_id: owner,
        factial_user: factial_user,
        owner: undefined,
        fact_us: undefined,
      };
      delete objectIn._id;
      delete objectIn.fact_us;
      delete objectIn.owner;

      await ObjectInfo.collection.insertOne(objectIn);
      response.status(200).send({ key: true });
    } catch (err) {
      response.status(404);
    }
  }
);

app.put(
  "/api/editobj/:id",
  verfyToken,
  jsonParser,
  async (request, response) => {
    let id = new ObjectID(request.params.id);
    update = request.body.objinf;
    let owner_id = request.body.objinf.owner_id;
    let factial_user = request.body.objinf.factial_user;

    if (owner_id) {
      let owner_id_obj = new mongoose.Types.ObjectId(owner_id);
      update.owner_id = owner_id_obj;
    }
    if (factial_user) {
      let f_u = factial_user.map((elem) => new mongoose.Types.ObjectId(elem));
      update.factial_user = f_u;
    }
    update.lastdate = new Date(Date.now());

    let obj = await ObjectInfo.findOneAndUpdate({ _id: id }, update, {
      new: true,
    });
    if (!obj) response.status(404);
    else response.send(obj);
  }
);

app.post("/api/findUser", verfyToken, jsonParser, async (request, response) => {
  let req = `(?i)${request.body.name}(?-i)`;
  let users = await UserInfo.find().regex("name", req);
  if (users) response.send(users.map((el) => el.name).slice(0, 7));
  else response.status(404);
});

app.post("/api/addMeeting",verfyToken, jsonParser, async (request, response) => {
  let objects_ = request.body.objects; 
  let users_id = request.body.users;
  let objects = await ObjectInfo.find({address: objects_},{_id: true, factial_user: true});
  console.log(objects)
  if(objects) {
          let users = [];

          objects.forEach(elem => (users.push(...elem.factial_user)));
          let users_req = await UserInfo.find({name: users_id}, {_id:true});

          users_req = users_req.map(elem => {return elem._id})
          users.push(...users_req);

          let objectsP = objects.map(elem => {return elem._id});

          await Meetings.collection.insertOne({...request.body, users_id: users, objects_id: objectsP, result: "", status: "wait"});

          response.send(users);
      }
  else response.status(404);
});

app.post("/api/getMeetings", verfyToken, jsonParser, async (request, response) => {

  let page = request.body.page
  page = !page ? 0 : page;

  const pageCount = 2

  let id = response.locals.id;
  let meetings = await Meetings.find({users_id: id}).skip(page*pageCount).limit(pageCount);

  console.log(meetings)

  for(i in meetings){
      let objects = await ObjectInfo.find({_id: meetings[i].objects_id},
          {address: true, status: true, field:true, district: true, area: true});
      let users = await UserInfo.find({_id: meetings[i].users_id},
              {name: true, picture: true});
      meetings[i] = {...meetings[i], objects: objects, users: users}
  }

  let meeting = await Meetings.count({users_id: id});
  
  let countPage = Math.ceil(meeting/pageCount);



  response.status(200).send({meetings: meetings, pages: countPage})

});


function verfyToken(request, response, next) {
  const header = request.headers["authorization"];
  console.log("got " + header);
  if (typeof header !== undefined && header) {
    jwt.verify(header.split(" ")[1], "MIREAfan", async function (err, decoded) {
      console.log(decoded);
      if (err) {
        response.status(401).send({});
      } else if (decoded.exp <= Date.now()) {
        let res = await UserInfo.findOne(
          { email: decoded.login },
          { email: true, _id: true }
        );
        console.log(res);
        if (res.email === decoded.login) {
          response.locals.id = res._id;
          next();
        }
      }
    });
  } else {
    response.status(401).send({});
  }
}

app.post(
  "/api/findFields",
  verfyToken,
  jsonParser,
  async (request, response) => {
    let req = `(?i)${request.body.text}(?-i)`;

    fields = await ObjectInfo.find({}, { field: true }).regex("field", req);
    un_fields = [...new Set(fields.map((item) => item.field))].slice(0, 7);

    response.send(un_fields);
  }
);

app.post(
  "/api/findObject",
  verfyToken,
  jsonParser,
  async (request, response) => {
    let req = `(?i)${request.body.text}(?-i)`;
    obj = await ObjectInfo.find({}, { address: true }).regex("address", req);

    un_fields = obj.map((obj) => obj.address).slice(0, 7);

    response.send(un_fields);
  }
);

app.post(
  "/api/findDistrict",
  verfyToken,
  jsonParser,
  async (request, response) => {
    let req = `(?i)${request.body.text}(?-i)`;

    district = await ObjectInfo.find({}, { district: true }).regex(
      "district",
      req
    );
    un_district = [...new Set(district.map((item) => item.district))].slice(
      0,
      7
    );

    response.send(un_district);
  }
);

main();

app.get("/api/public/download/*", (req, res, next) => {
  res.download("uploads/" + req.path.substring(21).replace("%20", " "), {
    root: __dirname,
  });
});

app.get("/api/public/*", (req, res, next) => {
  res.sendFile("uploads/" + req.path.substring(12).replace("%20", " "), {
    root: __dirname,
  });
});

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  console.log("Приложение завершило работу");
  process.exit();
});
