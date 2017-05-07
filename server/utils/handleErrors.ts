import * as e from 'express';

export function handleErr(err: Error, res: e.Response): void {
	let code: number;

	// Special cases
	switch(err.message) {
		case 'TIMESTAMP_EXISTS':
		case 'TIMESTAMP_MISSING':
		case 'NO_ROW_UPDATED':
		case 'METADATA_MISMATCH':
		case 'DATA_INVALID':
		case 'NUMBER_MISSING':
			code = 400;
			break;
		case 'UNAUTHORISED':
			code = 401;
			break;
		case 'NOT_ADMIN':
		case 'PLUGIN_DISABLED':
			code = 403;
			break;
		case 'NOT_FOUND':
			code = 404;
			break;
		default:
			console.error(err);
			code = 500;
	}

	res.status(code).send(err.message);
};