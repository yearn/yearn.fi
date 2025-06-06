type TPortalsError = {response: {data: {message: string}}};

export function isValidPortalsErrorObject(error: TPortalsError | unknown): error is TPortalsError {
	if (!error) {
		return false;
	}

	if (typeof error === 'object' && 'response' in error) {
		if (!error.response) {
			return false;
		}

		if (typeof error.response === 'object' && 'data' in error.response) {
			if (!error.response.data) {
				return false;
			}

			if (typeof error.response.data === 'object' && 'message' in error.response.data) {
				return !!error.response.data.message;
			}
		}
	}

	return false;
}
