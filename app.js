const express = require('express');
const cors = require('cors')
const multer  = require('multer')
const { randomUUID } = require('crypto');
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const app = express();

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: function (req, file, cb) {
        const fileExtension = file.originalname.split('.').pop()
        const uniqueFileName = randomUUID() + '.' + fileExtension
        cb(null, uniqueFileName)
      }
})

const upload = multer({ dest: 'uploads/', storage: storage })

app.use(cors())

const KEY_FILE_PATH = path.join("credentials.json");

const SCOPES = ["https://www.googleapis.com/auth/drive"];

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
})

app.listen(3000, () => {
 console.log("Server running on port 3000");
});

app.get("/refresh", async (_, res) => {
    console.log("Refresh on " + new Date())
    res.status(200);
    res.send({
        message: 'OK',
      });
})

app.post("/wedding-wishes", upload.array('images', 10), async (req, res) => {
    const fileSizeList = req.files.map(file => file.size)
    if(req.files.length > 10 || fileSizeList.find(filesize => filesize > 10000000)) {
        throw new Error('File error')
    }

    const wishesFilename = randomUUID() + ".txt"

    if(req.body.wishes && req.body.user) {
        var writeStream = await fs.createWriteStream(wishesFilename);
        await writeStream.write("Zyczenia: " + req.body.wishes);
        await writeStream.write("\nZyczy: " + req.body.user);
        await writeStream.end();
    
        google.drive({ version: "v3", auth: auth }).files
          .create({
              media: {
                  mimeType: "text/plain",
                  body: fs.createReadStream(wishesFilename)
              },
              requestBody: {
                  name: wishesFilename,
                  parents: [process.env.FOLDER_ID]
              },
              fields: "id"
          }).then(() => {fs.unlinkSync(wishesFilename) })
    }

    const authorIdentifierSuffix = wishesFilename.split('-')[0]

    for (const file of req.files) {
        const filename = authorIdentifierSuffix + '-' + file.filename
      google.drive({ version: "v3", auth: auth }).files
      .create({
          media: {
              mimeType: file.mimeType,
              body: fs.createReadStream(file.path)
          },
          requestBody: {
              name: filename,
              parents: [process.env.FOLDER_ID]
          },
          fields: "id"
      }).then(() => { 
        fs.unlinkSync(file.path) 
    })
    }

    res.status(200);
    res.send({
        message: 'OK',
      });
});