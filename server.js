const express = require("express");
const multer = require("multer");
const ftp = require("basic-ftp");
const path = require("path");
const fs = require("fs");
const os = require("os");
const FtpSrv = require("ftp-srv");

// Function to get the local IP address
function getLocalIPAddress() {
	const interfaces = os.networkInterfaces();
	for (const iface of Object.values(interfaces)) {
		for (const config of iface) {
			if (config.family === "IPv4" && !config.internal) {
				return config.address;
			}
		}
	}
	return "127.0.0.1"; // Fallback to loopback address if no external IP is found
}

const app = express();
const PORT = 3000;
const FTP_HOST = getLocalIPAddress();

// Generate random port, username, and password
const FTP_PORT = Math.floor(2000 + Math.random() * 30000); // Random port between 2000 and 32000
const FTP_USER = `${Math.random().toString(36).substring(2, 10)}`; // Random username
const FTP_PASSWORD = Math.random().toString(36).slice(-8); // Random 8-character password

// Display generated credentials in the console
console.log(`Randomized FTP Credentials:
	- Host: ${FTP_HOST}
	- Port: ${FTP_PORT}
	- Username: ${FTP_USER}
	- Password: ${FTP_PASSWORD}`);

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Start an in-memory FTP server
const ftpServer = new FtpSrv({
	url: `ftp://${FTP_HOST}:${FTP_PORT}`,
	greeting: ["Welcome to the randomized test FTP server!"],
});

// Handle FTP login
ftpServer.on("login", ({ connection, username, password }, resolve, reject) => {
	if (username === FTP_USER && password === FTP_PASSWORD) {
		const userRoot = path.join(__dirname, "ftp-root");
		if (!fs.existsSync(userRoot)) {
			fs.mkdirSync(userRoot); // Create user root directory if it doesn't exist
		}
		resolve({ root: userRoot });
	} else {
		reject(new Error("Invalid credentials"));
	}
});

// Start the FTP server
ftpServer.listen().then(() => {
	console.log(`FTP Server is running at ftp://${FTP_HOST}:${FTP_PORT}`);
});

// Configure multer to use original filenames
// const storage = multer.diskStorage({
// 	destination: (req, file, cb) => {
// 		const uploadDir = path.join(__dirname, "uploads");
// 		if (!fs.existsSync(uploadDir)) {
// 			fs.mkdirSync(uploadDir); // Create the directory if it doesn't exist
// 		}
// 		cb(null, uploadDir);
// 	},
// 	filename: (req, file, cb) => {
// 		cb(null, file.originalname); // Use the original name of the file
// 	},
// });
// const upload = multer({ storage });

// FTP Client configuration
const FTP_CONFIG = {
	host: FTP_HOST,
	port: FTP_PORT,
	user: FTP_USER,
	password: FTP_PASSWORD,
};

// Upload file to local filesystem
app.post("/upload", (req, res) => {
	const uploadDir = path.join(__dirname, "ftp-root");

	if (!fs.existsSync(uploadDir)) {
		fs.mkdirSync(uploadDir); // Create the directory if it doesn't exist
	}

	const fileName = req.headers["file-name"];
	if (!fileName) {
		return res.status(400).send("Missing 'file-name' header");
	}

	const filePath = path.join(uploadDir, fileName);
	const fileStream = fs.createWriteStream(filePath);

	req.pipe(fileStream);

	req.on("end", () => {
		res.send("File uploaded successfully");
	});

	req.on("error", (err) => {
		console.error("Error uploading file:", err);
		res.status(500).send("Failed to upload file: " + err.message);
	});
});

// List files on FTP
app.get("/files", (req, res) => {
	const searchQuery = req.query.search || ""; // Get the search query from the URL
	const uploadDir = path.join(__dirname, "ftp-root");

	fs.readdir(uploadDir, (err, files) => {
		if (err) {
			console.error("Error reading upload directory:", err);
			return res.status(500).send("Failed to load files: " + err.message);
		}

		// Filter the files based on the search query (case-insensitive)
		const filteredFiles = files.filter((file) =>
			file.toLowerCase().includes(searchQuery.toLowerCase())
		);
		console.log("Files loaded:", filteredFiles);

		res.json({
			files: filteredFiles,
			ftpCredentials: {
				host: FTP_HOST,
				port: FTP_PORT,
				user: FTP_USER,
				password: FTP_PASSWORD,
			},
		});
	});
});

// Download file from local directory
app.get("/download/:filename", (req, res) => {
	const { filename } = req.params;
	const filePath = path.join(__dirname, "ftp-root", filename);

	// Check if the file exists
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			console.error("File not found:", filename);
			return res.status(404).send("File not found");
		}

		// Handle client disconnections
		let downloadAborted = false;
		req.on("close", () => {
			if (!res.writableEnded) {
				downloadAborted = true;
				console.log(`Download aborted by client: ${filename}`);
			}
		});

		// Start the download process
		res.download(filePath, filename, (err) => {
			if (err) {
				if (err.code === "EPIPE") {
					console.warn("EPIPE: Client disconnected during download.");
				} else {
					console.error("Error during download:", err);
				}
				if (!res.headersSent) {
					res.status(500).send("Error downloading the file.");
				}
			} else if (!downloadAborted) {
				console.log(`File successfully downloaded: ${filename}`);
			}
		});
	});
});

// Delete file from local directory
app.delete("/delete/:filename", (req, res) => {
	const { filename } = req.params;
	const filePath = path.join(__dirname, "ftp-root", filename);

	// Check if the file exists
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			console.error("File not found:", filename);
			return res.status(404).send("File not found");
		}

		// Delete the file
		fs.unlink(filePath, (err) => {
			if (err) {
				console.error("Error deleting file:", err);
				return res.status(500).send("Failed to delete file: " + err.message);
			}

			res.send("File deleted successfully");
		});
	});
});

// Fallback to index.html for unmatched routes (optional for SPAs)
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the HTTP server
app.listen(PORT, () => {
	console.log(`Server running at http://${FTP_HOST}:${PORT}`);
});
