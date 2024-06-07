const express = require("express");
const { resolve } = require("path");
const mysql = require("mysql2/promise");
const fs = require("node:fs");
const cors = require("cors");
const multer = require("multer");
const UPLOAD_FILES_DIR = "./uploads";
const app = express();
const port = process.env.PORT || 3010;
var con;

// Setup cors
app.use(cors());

// Create SQL Connection
createSQLConnection();

// File Storage Setup
const storage = multer.diskStorage({
	destination(req, file, cb) {
		cb(null, UPLOAD_FILES_DIR);
	},
	// in case you want to change the names of your files)
	filename(req, file = {}, cb) {
		//file.mimetype = "audio/webm";
		// console.log(req)
		const { originalname } = file;
		const fileExtension = (originalname.match(/\.+[\S]+$/) || [])[0];
		cb(null, `${file.fieldname}${Date.now()}${fileExtension}`);
	},
});
const upload = multer({ storage });

async function createSQLConnection() {
	con = await mysql.createConnection(
		`mysql://avnadmin:AVNS_a66tKd6_5pdZrtTP9ib@mysql-hisham-astratech-interview-hishamfangs-8c23.f.aivencloud.com:21650/defaultdb?ssl-mode=REQUIRED`
	);

	await connectToSQL();
	//await selectStatement();
}

async function connectToSQL() {
	return new Promise((resolve, reject) => {
		con.connect(function (err) {
			if (err) {
				console.log(err);
				throw err;
			}
			console.log("Connected!");
			resolve();
		});
	});
}
/* app.use(express.static("static"));

app.get("/", (req, res) => {
	res.sendFile(resolve(__dirname, "pages/index.html"));
}); */

/*****
 *
 *  Get Files
 *
 *********************/
app.get("/getFiles", async (req, res) => {
	let files = "";
	let mode = req.query?.mode;
	console.log("Request recieved with mode: " + mode);
	if (!mode) {
		console.log("Defaulting to Recent mode");
	}
	try {
		if (mode == "all") {
			var [results, fields] = await con.query(
				"SELECT * FROM tb_files ORDER BY datetime_created DESC"
			);
		} else {
			// Recent
			var [results, fields] = await con.query(
				`SELECT * 
						FROM tb_files a
					WHERE 1 >= (
						SELECT COUNT(DISTINCT(b.datetime_created)) 
						FROM tb_files b
						WHERE b.datetime_created >= a.datetime_created)
					ORDER BY a.datetime_created DESC`
			);
		}

		console.log(results); // results contains rows returned by server
		files = results;
		//console.log(fields); // fields contains extra meta data about results, if available
	} catch (err) {
		console.log(err);
	}

	res.send(files);
});

/*****
 *
 *  Upload Files
 *
 *********************/
app.post("/uploadFiles", upload.array("files", 5), async function (req, res) {
	try {
		console.log(req.files, "files");
		//logs 3 files that have been sent from the client
		res.end("Files Uploaded Successfully");
		if (!req.files.length) {
			res.send({ success: false, message: "No Files were sent" });
		}
		let insertQuery = `
		INSERT INTO tb_files(
			file_name,
			original_file_name,
			file_path,
			file_size,
			file_type,
			datetime_created
		)
	values`;
		for (let f in req.files) {
			let file = req.files[f];
			insertQuery += `(
				'${file.filename}',
				'${file.originalname}',
				'${file.path}',
				${file.size},
				'${file.mimetype}',
				NOW()
			)
		`;
			if (req.files[parseInt(f) + 1]) {
				insertQuery += ", ";
			}
		}
		console.log(insertQuery);
		var [results, fields] = await con.query(insertQuery);
		res.end({ success: true, message: "Files Uploaded Successfully" });
		//const content = "Some content!";
		//await fs.writeFile("/files/" + req.files.foo, content);
	} catch (err) {
		console.log(err);
		res.end({ success: false, message: err });
	}
});

app.put("/update/:id", async (req, res) => {
	try {
		const [results, fields] = await con.query(
			`UPDATE tb_files 
				SET datetime_updated = NOW()
			WHERE id = ${req.params.id}			
			`
		);

		console.log(results); // results contains rows returned by server
		res.send({ success: true, message: "File Updated Successfully" });
		//console.log(fields); // fields contains extra meta data about results, if available
	} catch (err) {
		console.log(err);
		res.send({ success: false, message: err });
	}
	res.end;
});

app.delete("/delete/:id", async (req, res) => {
	try {
		const [results, fields] = await con.query(
			`DELETE FROM tb_files 
			WHERE id = ${req.params.id}			
			`
		);

		console.log(results); // results contains rows returned by server
		res.send({ success: true, message: "File Deleted Successfully" });
		//console.log(fields); // fields contains extra meta data about results, if available
	} catch (err) {
		console.log(err);
		res.send({ success: false, message: err });
	}
	res.end();
});

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});
