require("dotenv").config();
const moment = require("moment");
const request = require("es6-request");
const GoogleSpreadsheet = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(process.env.DOCUMENT_KEY);

// Due to an error, after installation, manually add the follwing pull request:
// https://github.com/theoephraim/node-google-spreadsheet/pull/152
// in node_modules/google-spreadsheet/index.js

// Google credentials as explained in the README
const creds = {
	client_email: process.env.CLIENT_EMAIL, // Make sure this email has write permission
	private_key: process.env.PRIVATE_KEY
};

// Cache the URLs to update information once an URL has changed
const cache = {};

// Fetch the ID from the https://dumpert.nl/(...) URL
const getIdFromUrl = (url) => {
	const matches = url.match(/^https:\/\/www.dumpert.nl\/mediabase\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/.*/);

	// If the link is not valid, return null
	if (!matches || matches.length === 1) {
		return null;
	}

	return `${matches[1]}_${matches[2]}`;
};

const fetchData = async (rows) => {
	// Fetch all the results in series
	for (const row of rows) {
		// Exit early for rows that already have been fetched
		if (cache[row.nummer] && cache[row.nummer] === row["dumpert-link"]) {
			continue;
		}

		// Skip rows that don't have a valid URL
		const id = getIdFromUrl(row["dumpert-link"]);
		if (!id) {
			cache[row.nummer] = row["dumpert-link"];
			continue;
		}

		let [body] = await request.get(`https://api.dumpert.nl/mobile_api/json/info/${id}/`);
		// Parse the body to JSON
		try {
			body = JSON.parse(body);
		} catch (err) {
			console.error(`[${moment().format("YYYY-MM-DD HH:mm:ss")}]`, err);
			cache[row.nummer] = row["dumpert-link"];
			continue;
		}

		if (!body.success) {
			cache[row.nummer] = row["dumpert-link"];
			continue;
		}

		let item = body.items[0];

		row.titel = item.title;
		row.uploaddatum = moment(item.date).format("YYYY-MM-DD HH:mm");
		row.views = item.stats.views_total;
		row.kudos = item.stats.kudos_total;
		row.nsfw = item.nsfw ? "Ja" : "Nee";
		row.lengte = moment().startOf("day").add(item.media[0].duration, "seconds").format("HH:mm:ss");
		row.thumbnail = item.stills.still;

		row.save((err) => {
			if (err) {
				console.error(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Row ${row.nummer}`, err);
			}

			console.log(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] Processed ${row.nummer}`);
		});
	}
};

new Promise((resolve, reject) => {
	doc.useServiceAccountAuth(creds, () => {
		// Fetch info about the spreadsheet
		doc.getInfo((err, spreadsheet) => {
			if (err) {
				return reject(err);
			}

			return resolve(spreadsheet);
		});
	});
})
.then(async (spreadsheet) => {
	const updater = () => {
		// Use the first worksheet
		const worksheet = spreadsheet.worksheets[0];

		// Get all the rows except the first row (headers)
		worksheet.getRows({
			offset: 1	
		}, (err, rows) => {
			if (err) {
				console.error(`[${moment().format("YYYY-MM-DD HH:mm:ss")}]`, err);
				return;
			}
	
			// For all rows that already have data set, add the URL to the cache
			rows.filter((row) => {
				return row["dumpert-link"] && row["dumpert-link"].substr(0, 8) === "https://" && row.lengte;
			})
			.forEach((row) => {
				cache[row.nummer] = row["dumpert-link"];
			});

			// Fetch data for all rows that have an URL set
			return fetchData(rows.filter((row) => {
				return row["dumpert-link"] && row["dumpert-link"].substr(0, 8) === "https://";
			}));
		});
	}

	return updater();
})
.catch((err) => {
	console.error(`[${moment().format("YYYY-MM-DD HH:mm:ss")}]`, err);
});