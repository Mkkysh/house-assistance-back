const express = require("express");
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");
const fs = require("fs")

const app = express();
const parser = new XMLParser();
let fileContent = fs.readFileSync("uploads/test.xml", "utf8");

jObj = parser.parse(fileContent);

JobjectHouse = jObj.object
console.log(jObj.ObjectInfo)



app.get("/", function(request, response){
    
    response.send("Hi");
});

app.listen(3000);