import Observer, {isolate} from '../Observer/Observer';
import observable from '../observable/observable';

export interface IQuery {
	key?: string;
	qwery?: IQueryData;
	(collection: any[]): any[];
	where(property: string, value): IQuery;
	where(property: string, operator: '==' | '===' | '<' | '>' | '>=' | '<=', value): IQuery;
	orderBy(property: string, direction: 'desc' | 'asc'): IQuery;
	limit(count: number): IQuery;
}

export interface IQueryData {
	where: {property: string, operator: string, value: any}[];
	orderBy: {property: string, direction: string};
	limit: {count: number};
}

const cache: {[index: string]: IQuery} = {};

function sortedIndexOf(list, item, comparator) {
	let min = 0;
	let max = list.length;
	let middle = -1;

	while (min < max) {
		middle = (min + max) / 2 | 0;

		switch (comparator(list[middle], item)) {
			case -1:
				min = middle + 1;
				break;
			case 1:
				max = middle;
				break;
			case 0:
				return middle;
		}
	}

	return min;
}

function getData(prev: IQueryData): IQueryData {
	return {
		where: prev.where && prev.where.slice(0) || [],
		orderBy: prev.orderBy || null,
		limit: prev.limit || null,
	};
}

function compile(key, {where, orderBy, limit = null}: IQueryData) {
	let filter = null;
	let comparator = null;
	let properties = [];

	if (where.length) {
		filter = Function('item', 'return ' + where.map(({property, operator, value}) => {
				properties.push(property);
				return `item.${property} ${operator} ${JSON.stringify(value)}`;
			}).join(' && '));
	}

	if (orderBy) {
		const {property:byProp, direction} = orderBy;

		!properties.includes(byProp) && properties.push(byProp);

		comparator = function orderByComparator(a, b) {
			const aVal = a[byProp];
			const bVal = b[byProp];
			return aVal === bVal ? 0 : (aVal < bVal ? -1 : 1) * (direction === 'desc' ? -1 : 1);
		};
	}

	return {
		key,
		properties,

		init: isolate(function (collection) {
			let next = collection;

			if (filter !== null) {
				next = next.filter(filter);
			}

			if (next.length) {
				if (comparator !== null) {
					next = next.slice(0).sort(comparator);
				}

				if (limit !== null) {
					next = next.slice(0, limit.count);
				}
			}

			return next;
		}),

		filter,

		push: isolate(function (collection, item) {
			if (filter === null || filter(item)) {
				const length = collection.length;
				const success = limit === null || length < limit.count;

				if (comparator) {
					const idx = sortedIndexOf(collection, item, comparator);

					if (idx < length) {
						collection.splice(idx, 0, item);

						if (limit !== null && length === limit.count) {
							collection.splice(length, 1);
						}

						return true;
					} else if (success) {
						collection.push(item);
						return true;
					}
				} else if (success) {
					collection.push(item);
					return true;
				}
			}

			return false;
		})
	};
}

function applyCursor(collection, cursor) {
	if (!collection.hasOwnProperty('__streams')) {
		Object.defineProperties(collection, {
			'__streams': {
				value: {
					/*
					 [cursor.key]: any[]{
					 key,
					 target,
					 invalidated: true,
					 invalidateStream(),
					 handlePush,
					 handleChange,
					 }
					 */
				}
			}
		});

		observable(collection);
	}

	const streams = collection.__streams;
	const key = cursor.key;
	let stream = streams[key];

	if (stream === void 0) {
		stream = streams[key] = {
			key,
			data: null,
			invalidated: true,

			invalidateStream: () => {
				if (stream.invalidated) {
					collection.unsubscribe('push', stream.handlePush);
					collection.unsubscribe('change', stream.handleChange);
					collection.unsubscribe('splice', stream.invalidateStream);
					delete streams[key];
				} else {
					stream.invalidated = true;
					stream.data && stream.data.emit('invalidate');
				}
			},

			handlePush: ({target}) => {
				if (cursor.push(stream.data, target)) {
					stream.invalidateStream();
				}
			},

			handleChange: ({property}) => {
				if (stream.data !== null && cursor.properties.includes(property)) {
					stream.invalidateStream();
				}
			}
		};

		collection.subscribe('change', stream.handleChange);
		collection.subscribe('push', stream.handlePush);
		collection.subscribe('splice', stream.invalidateStream);
	}

	if (stream.invalidated) {
		stream.data = observable(cursor.init(collection));
		stream.invalidated = false;
	}

	if (Observer.active) {
		stream.data.subscribe('invalidate', Observer.active);
	}

	return stream.data;
}

function getNext(query: IQuery, type, nextKey, item): IQuery {
	const key = query.key ? `${query.key}->${type}:${nextKey}` : `${type}:${nextKey}`;

	if (!cache.hasOwnProperty(key)) {
		let compiled;
		const cursor: any = function queryCursor(collection) {
			return applyCursor(collection, compiled);
		};

		let qwery = cursor.qwery = getData(query.qwery);

		cursor.key = key;
		cursor.where = where;
		cursor.orderBy = orderBy;
		cursor.limit = limit;

		if (type === 'where') {
			qwery[type].push(item);
		} else {
			qwery[type] = item;
		}

		compiled = compile(key, qwery);
		cache[key] = cursor;
	}

	return cache[key];
}

function where(property, operator, value): IQuery {
	if (arguments.length === 2) {
		value = operator;
		operator = '==';
	}

	return getNext(this, 'where', `${property}:${operator}:${value}`, {property, operator, value});
}

function orderBy(property, direction = 'desc') {
	return getNext(this, 'orderBy', `${property}:${direction}`, {property, direction});
}

function limit(count) {
	return getNext(this, 'limit', count, {count});
}

// Export
const query: IQuery = <IQuery>{
	key: 'root',
	qwery: {},
	where,
	orderBy,
	limit,
};
export default query;
