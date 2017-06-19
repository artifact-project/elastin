import Observer from '../Observer/Observer';

export interface IObserverble {
	__observableId: string;
	__observerMap: {[index: number]: number};
	__listeners: {[index: string]: Function[]};
	emit(name: string, arg);
	subscribe(name: string, observer: Observer): IObserverble;
	unsubscribe(name: string, observer: Observer): IObserverble;
	handleItemChange?();
	itemSubscriber?();
}

const coreArr = Array.prototype;
let cid = 0;
let syncDebounce = null;

function getListeners(target, name) {
	const __listeners = target.__listeners;

	if (!__listeners.hasOwnProperty(name)) {
		__listeners[name] = [];
	}

	return __listeners[name];
}

function emit(this: IObserverble, name: string, arg) {
	const isRoot = syncDebounce === null;
	const list = getListeners(this, name);
	const __observerMap = this.__observerMap;
	let idx = list.length;

	if (isRoot) {
		syncDebounce = {
			list: [],
			exists: {},
			changed: {},
		};
	}

	// console.log(name, this.__observableId, arg);

	while (idx--) {
		const observer = list[idx];
		const obsId = observer.id;

		if (observer instanceof Observer) {
			if (__observerMap[obsId] !== observer.tick || observer.invalidated || observer.destroyed) {
				console.log('emit.auto.unsubscribe:', obsId, observer.invalidated, observer.destroyed);
				list.splice(idx, 1);
				delete __observerMap[obsId];
			} else if (!syncDebounce.exists.hasOwnProperty(obsId)) {
				const skey = `${this.__observableId}:${name}`;

				syncDebounce.exists[obsId] = true;

				if (!syncDebounce.changed.hasOwnProperty(skey)) {
					syncDebounce.changed[skey] = true;
					syncDebounce.list.push(observer);
				}
			}
		} else {
			observer(arg);
		}
	}

	if (isRoot) {
		const list = syncDebounce.list;

		syncDebounce = null;
		list.forEach(observer => {
			observer.notify();
		});
	}
}

function subscribe(this: IObserverble, name, observer) {
	if (!observer.hasOwnProperty('id')) {
		observer.id = ++cid;
	}

	const list = getListeners(this, name);
	let key = `${this.__observableId}:${name}:${observer.id}`;

	if (observer instanceof Observer) {
		this.__observerMap[observer.id] = observer.tick;
	}

	if (!observer.hasOwnProperty(key)) {
		observer[key] = true;
		list.unshift(observer);
	}

	return this;
}

function unsubscribe(this: IObserverble, name, observer) {
	const list = getListeners(this, name);
	const idx = list.indexOf(observer);

	if (idx > -1) {
		list.splice(idx, 1);
		delete this.__observerMap[observer.id];
	}

	return this;
}

function arrayPush(this: IObserverble, target) {
	const idx = coreArr.push.call(this, target);

	observable(target, null, this.itemSubscriber);
	this.emit('push', {target});

	return idx;
}

function arraySplice(this: IObserverble, start, deleteCount) {
	const results = coreArr.splice.call(this, start, deleteCount);
	this.emit('splice', {});
	return results;
}

export default function observable<T>(origTarget: T, keys = null, activator = null): T {
	const target = <IObserverble><any>origTarget;

	if (target.hasOwnProperty('__observableId')) {
		return origTarget;
	}

	Object.defineProperties(target, {
		'__observableId': {value: `__observable${++cid}`},
		'__listeners': {value: {}},
		'__observerMap': {value: {}},
		'emit': {value: emit},
		'subscribe': {value: subscribe},
		'unsubscribe': {value: unsubscribe},
	});

	if (Array.isArray(target)) {
		Object.defineProperties(target, {
			'push': {value: arrayPush},
			'splice': {value: arraySplice},
			'handleItemChange': {
				value(evt) {
					target.emit('change', evt)
				}
			},
			'itemSubscriber': {
				value(item) {
					item.subscribe('change', target.handleItemChange)
				}
			},
		});

		target.forEach(item => observable(
			item,
			keys,
			target.itemSubscriber
		));
	} else {
		(keys === null) && (keys = Object.keys(target));

		const privateData = {};
		const privateDataIsArray = {};

		keys.forEach(property => {
			privateData[property] = target[property];
			privateDataIsArray[property] = Array.isArray(target[property]);

			Object.defineProperty(target, property, {
				enumerable: true,

				get() {
					const value = privateData[property];

					if (Observer.active) {
						if (privateDataIsArray[property]) {
							observable(value)
								.subscribe('push', Observer.active)
								.subscribe('splice', Observer.active)
							;
						}

						this.subscribe(`change:${property}`, Observer.active);
					}

					return value;
				},

				set(value) {
					const previous = privateData[property];

					if (value !== previous) {
						privateData[property] = value;
						privateDataIsArray[property] = Array.isArray(value);

						this.emit(`change:${property}`, {target: this, property, value, previous});
						this.emit('change', {target: this, property, value, previous});
					}
				}
			});
		});

		(activator !== null) && activator(target);
	}

	return <T><any>target;
}
