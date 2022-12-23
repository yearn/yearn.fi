import dayjs, {extend} from 'dayjs';
import dayjsDuration from 'dayjs/plugin/duration.js';
import utc from 'dayjs/plugin/utc';
import weekday from 'dayjs/plugin/weekday';

extend(dayjsDuration);
extend(weekday);
extend(utc);

export function	getLastThursday(): number {
	const	today = dayjs().utc();
	let		lastThursday = today.weekday(4);
	lastThursday = lastThursday.set('hour', 0);
	lastThursday = lastThursday.set('minute', 0);
	lastThursday = lastThursday.set('second', 0);
	if (today.isBefore(lastThursday)) {
		return (lastThursday.subtract(1, 'week').unix());
	}
	return (lastThursday.unix());
}

export function	getNextThursday(): number {
	const	today = dayjs().utc();
	let		nextThursday = today.weekday(4);
	nextThursday = nextThursday.set('hour', 0);
	nextThursday = nextThursday.set('minute', 0);
	nextThursday = nextThursday.set('second', 0);
	if (today.isAfter(nextThursday)) {
		return (nextThursday.add(1, 'week').unix());
	}
	return (nextThursday.unix());
}
