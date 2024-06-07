const express = require("express");
const { resolve } = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const multer = require("multer");
const UPLOAD_FILES_DIR = "./uploads";
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const port = process.env.PORT || 3010;
var con;

// Setup cors
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create SQL Connection
createSQLConnection();

// File Storage Setup
const storage = multer.diskStorage({
	destination(req, file, cb) {
		cb(null, UPLOAD_FILES_DIR);
	},
	// Change the name of the file for security
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
	con = await mysql.createConnection(process.env.DBCONNECTION_STRING);
	await connectToSQL();
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

/*****
 *
 *  Update Files: simply updates the datetime_updated value
 *
 *********************/
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

/*****
 *
 *  Deletes File from Database
 *
 *********************/
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

/************************/
/**** Authentication ****/
/************************/

const generateAccessToken = (userId) => {
	return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};
const getUser = async (username) => {
	const query = `SELECT * FROM tb_users WHERE username = '${username}'`;
	var [results, fields] = await con.query(query);
	return results;
};

/*****
 *  Register New User: disabled for now
 *****************************************/
/* 
const insertUser = async (username, password) => {
	const query = `INSERT INTO tb_users SET username = '${username}', password = '${password}'`;
	var [results, fields] = await con.query(query);
	return results;
};

app.get("/register", async (req, res) => {
	// const { email, password } = req.body;
	const { username, password } = req.query;
	if (!username || !password) {
		res
			.status(400)
			.json({ error: "username or Password fields cannot be empty!" });
		return;
	}
	const salt = await bcrypt.genSalt(10);
	const hashedPassword = await bcrypt.hash(password, salt);
	const user = {
		username,
		password: hashedPassword,
	};
	try {
		//const userAlreadyExists = await checkRecordExists("users", "username", username);
		//if (userAlreadyExists) {
		//  res.status(409).json({ error: "username already exists" });
		//} else {
		const results = await insertUser(username, hashedPassword);
		res.status(201).json({ message: "User created successfully!" });
		//}
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});
 */

/*****
 *
 *  Login User
 *
 *****************************************/
app.post("/login", async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		res
			.status(400)
			.json({ error: "Username or Password fields cannot be empty!" });
		return;
	}

	try {
		const existingUser = await getUser(username);

		if (existingUser && existingUser.length) {
			if (!existingUser[0].password) {
				res.status(401).json({ error: "Invalid credentials" });
				return;
			}

			const passwordMatch = await bcrypt.compare(
				password,
				existingUser[0].password
			);

			if (passwordMatch) {
				res.status(200).json({
					username: existingUser[0].username,
					access_token: generateAccessToken(existingUser[0].username),
				});
			} else {
				res.status(401).json({ error: "Invalid credentials" });
			}
		} else {
			res.status(401).json({ error: "Invalid credentials" });
		}
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});
