let cid = 0;

export type IExecutor = () => void;

export interface IObserverOptions {
	onnotify?(val);
}

export default class Observer {
	static active: Observer = null;

	static wrap(func, options = {}) {
		const observer = new Observer(func, options);
		return function observerWrapper(...args) {
			return observer.call(this, args);
		};
	};

	id: number;
	tick: number;
	executor: IExecutor;
	args: object[];
	context: object;
	slaves: {[index: number]: object};
	slavesKeys: string[];
	options: IObserverOptions;
	lastResult: any;
	invalidated: boolean;
	destroyed: boolean;

	constructor(executor: IExecutor, options: IObserverOptions = {}) {
		this.id = ++cid;
		this.tick = 0;
		this.executor = executor;
		this.args = [];
		this.context = null;
		this.slaves = null;
		this.slavesKeys = null;
		this.options = options;
		this.lastResult = null;
		this.invalidated = false;
		this.destroyed = false;
	}

	call(context?, args?) {
		const __active = Observer.active;
		const oldSlaves = this.slaves;
		const oldSlaveKeys = this.slavesKeys;
		let retVal;

		if (__active) {
			this.invalidated = false;
		}

		Observer.active = this;

		if (arguments.length) {
			this.args = args || this.args;
			this.context = context;
		}

		this.tick++;
		this.slaves = {};
		this.slavesKeys = [];

		retVal = this.executor.apply(this.context, this.args);

		(oldSlaveKeys !== null) && oldSlaveKeys.forEach(id => {
			if (!this.slaves.hasOwnProperty(id)) {
				oldSlaves[id].invalidated = true;
			}
		});

		Observer.active = __active;
		this.lastResult = retVal;

		return retVal;
	}

	addSlave(observer) {
		const id = observer.id;

		if (this.slaves.hasOwnProperty(id)) {
			this.slaves[id] = observer;
			this.slavesKeys.push(id);
		}
	}

	notify() {
		const retVal = this.call();
		this.options.hasOwnProperty('onnotify') && this.options.onnotify(retVal);
	}

	destroy() {
		if (!this.destroyed) {
			const oldSlaveKeys = this.slavesKeys;

			this.destroyed = true;

			(oldSlaveKeys !== null) && oldSlaveKeys.forEach(id => {
				this.slaves[id].invalidated = true;
			});

			this.options = {};
			this.executor = null;
			this.args = null;
			this.context = null;
			this.lastResult = null;
			this.slaves = null;
			this.slavesKeys = null;
		}
	}
}

export function isolate(fn) {
	return function isolateWrapper() {
		const active = Observer.active;
		let retVal;

		Observer.active = null;
		retVal = fn.apply(this, arguments);
		Observer.active = active;

		return retVal;
	}
}

export function autorun(func: IExecutor, options?: IObserverOptions) {
	return new Observer(func, options).call();
}
