// Import the necessary Node.js modules
const express = require("express"); // Handles HTTP requests
const fs = require("fs"); // Performs file system operations
const path = require("path"); // Manages file and directory paths
require("dotenv").config(); // Loads environment variables from a .env file into process.env

// Create an Express application instance
const app = express();

// Retrieve the base URL path and port from environment variables or use defaults
const baseUrlPath = process.env.BASE_URL_PATH || "";
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
if (baseUrlPath) {
	app.use(baseUrlPath, express.static(path.join(__dirname, "public")));
} else {
	app.use("/", express.static(path.join(__dirname, "public")));
}

// Middleware to parse JSON bodies in incoming requests
app.use(express.json());

const bookingLogs = path.join(__dirname, "booking_data");

app.get(`${baseUrlPath}/api/single`, (req, res) => {
	const bookingIdQuery = req.query.bookingId; // Retrieve the bookingId from query parameters

	if (!bookingIdQuery) {
		// Respond with an error or empty array if no bookingId is specified
		return res.status(400).json({ message: "Booking ID required" });
	}

	fs.readdir(bookingLogs, (err, files) => {
		if (err) {
			console.error("Could not list the directory.", err);
			res.status(500).send("Internal server error");
			return;
		}

		let single = [];
		files.forEach((file) => {
			const filePath = path.join(bookingLogs, file);
			const bookingData = JSON.parse(fs.readFileSync(filePath, "utf8"));

			if (!bookingIdQuery || bookingData.bookingId === bookingIdQuery) {
				single.push(bookingData);
			}
		});

		// Optionally, sort and paginate results here if necessary
		res.json(single);
	});
});

app.get(`${baseUrlPath}/api/bookings`, (req, res) => {
	fs.readdir(bookingLogs, (err, files) => {
		if (err) {
			console.error("Could not list the directory.", err);
			res.status(500).send("Internal server error");
			return;
		}

		// Sort files by last modified time, descending
		files.sort((a, b) => {
			return fs.statSync(path.join(bookingLogs, b)).mtime.getTime() - fs.statSync(path.join(bookingLogs, a)).mtime.getTime();
		});

		// Get query parameters for pagination and limit
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 5; // Default is 5, can be overridden by query parameter
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;

		const testLogs = [];
		files.slice(startIndex, endIndex).forEach((file) => {
			const filePath = path.join(bookingLogs, file);
			const testData = fs.readFileSync(filePath);
			testLogs.push(JSON.parse(testData));
		});

		// Prepare response with pagination data
		const result = {
			total: files.length,
			nextPage: endIndex < files.length ? page + 1 : null,
			prevPage: page > 1 ? page - 1 : null,
			data: testLogs,
		};

		res.json(result);
	});
});

/**
 * GET endpoint for testing server responsiveness.
 * This endpoint dynamically adjusts based on the BASE_URL_PATH environment variable.
 *
 * @return {Response} Sends a text response confirming the successful GET request.
 */
app.get(`${baseUrlPath}/bookings`, (req, res) => {
	res.status(200).send("GET request to the /bookings endpoint");
});

/**
 * POST endpoint to handle incoming JSON payloads with a "bookingId".
 * It saves or updates a JSON file named after the "bookingId" in the "booking_logs" directory.
 * The endpoint's path is dynamically adjusted based on the BASE_URL_PATH environment variable.
 *
 * @param {Object} req.body - The JSON payload of the request, expected to contain "bookingId".
 * @return {Response} Indicates whether the corresponding file was created or updated.
 */
app.post(`${baseUrlPath}/bookings`, (req, res) => {
	const bookingId = req.body.bookingId; // Extracts the booking ID from the request body

	// Defines the path to the directory where booking logs will be stored
	const logsDir = bookingLogs;

	// Ensures the existence of the 'booking_logs' directory, creating it if necessary
	if (!fs.existsSync(logsDir)) {
		fs.mkdirSync(logsDir, { recursive: true });
	}

	// Constructs the full path for the new or existing file
	const filePath = path.join(logsDir, `${bookingId}.json`);

	// Writes the JSON payload to the file, creating or overwriting it as needed
	fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
		if (err) {
			console.error("Error writing file:", err);
			return res.status(500).send("Error processing request");
		}

		// Responds to indicate the action taken on the file
		res.status(200).send(`File for booking ID ${bookingId} ${fs.existsSync(filePath) ? "updated" : "created"} in the booking_logs folder.`);
	});
});

// Starts the server on the configured port and logs a startup message
app.listen(port, () => console.log(`Application is running on port ${port}`));
