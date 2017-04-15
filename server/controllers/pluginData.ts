import * as p from '../lib/plugins';
import * as e from 'express';

// TODO: Check auth headers

function handleErr(err: Error, res: e.Response): void {
	// Special cases
	switch(err.message) {
		case 'TIMESTAMP_EXISTS':
		case 'TIMESTAMP_MISSING':
		case 'NO_ROW_UPDATED':
			res.sendStatus(400);
			break;
		case 'IS_ADMIN':
			res.sendStatus(403);
			break;
		default:
			console.error(err);
			res.sendStatus(500);
	}
}

module.exports.get = function(req: e.Request, res: e.Response) {
	// We must have at least one query parameter, which is the number of
	// elements to return
	if(!req.query.number) {
		return res.sendStatus(400);
	}

	// Grab a connector and load the elements number
	let connector = p.PluginConnector.getInstance(req.params.plugin);

		let options: p.Options = <p.Options>{ number: parseInt(req.query.number) };
		
		// Load optional filters
		if(req.query.startTimestamp) options.startTimestamp = req.query.startTimestamp;
		if(req.query.type) options.type = req.query.type;
		
		// Run the query
		connector.getData(options, (err, data) => {
			if(err) return handleErr(err, res);
			// Check the user's access level before returning the data
			connector.getAccessLevel('brendan', (err, level) => { // TODO: Replace hard-coded username
				if(err) return handleErr(err, res);
				if(data) {
					// If the access level is set to "none", don't return drafts
					data = data.filter((data) => {
						if(level === p.AccessLevel.none) {
							if(!data.status.localeCompare('draft')) return false;
							else return true;
						}
						return true;
					});
				}
			})
			return res.status(200).send(data);
		})
}

module.exports.add = function(req: e.Request, res: e.Response) {
	// Check if the data is valid
	if(p.Data.isValid(req.body)) {
		// If data is valid, load the connector
		let connector = p.PluginConnector.getInstance(req.params.plugin);
		// Run the query
		connector.addData(<p.Data>req.body, (err) => {
			if(err) return handleErr(err, res);
			res.sendStatus(200);
		});
	} else {
		// If the data is invalid: 400 Bad Request
		res.sendStatus(400);
	}
}

module.exports.replace = function(req: e.Request, res: e.Response) {}

module.exports.delete = function(req: e.Request, res: e.Response) {}