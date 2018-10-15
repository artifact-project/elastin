export type Operator = '==' | '===' | '<' | '>' | '>=' | '<='
export type Direction = 'asc' | 'desc'

export interface Entry {
	id: string | number;
}

export interface Flow {
    ok: boolean;
    busy: boolean;
    failed: boolean;
    exists: boolean;
}

export type QFilter<T extends Entry, N extends keyof T> = {
    name: N;
    value: T[N];
    operator: Operator;
}

export type QOrder<T> = {
    name: keyof T;
    direction: Direction;
}

export type Qwery<T extends Entry> = {
    filters: QFilter<T, keyof T>[];
    orders: QOrder<T>[];
    offset: number;
    limit: number;
}

const F_OK = 1 << 1;
const F_FAILED = 1 << 2;
const F_EXISTS = 1 << 3;
const F_BUSY = 1 << 4;
const F_ACTIVATE = 1 << 5;
const STREAMS = {} as {[key: string]: Stream<any, any>};

function nextQFilter<T extends Entry>(qwery: Qwery<T>, filter: QFilter<T, keyof T>) {
    qwery.filters.push(filter);
}

function nextQOrder<T extends Entry>(qwery: Qwery<T>, order: QOrder<T>) {
    qwery.orders.push(order);
}

export type Listener<T> = (item: T, idx: number) => void;

function emitEvent<T>(this: {item: T, idx: number}, fn: Listener<T>) {
	fn(this.item, this.idx);
}

export class Emitter<T> {
    __onAdd: Listener<T>[];
	__onRemove: Listener<T>[];

    onAdd(fn: Listener<T>): void {
		this.__onAdd.push(fn);
	}

    onRemove(fn: Listener<T>): void {
		this.__onRemove.push(fn);
	}

    onChange(fn: () => void): void {
		this.__onAdd.push(fn);
        this.__onRemove.push(fn);
	}

    emitOnAdd(item: T, idx: number): void {
		this.__onAdd.forEach(emitEvent, {item, idx});
	}

    emitOnRemove(item: T, idx: number): void {
		this.__onRemove.forEach(emitEvent, {item, idx});
	}
}

export class Stream<T extends Entry, K extends keyof T = keyof T> implements Flow {
    private _state: number;
	private _index: Index<T>;

    constructor(private space: Space<T, K>, private rootKey: string, public qwery?: Qwery<T>) {
        this._state = F_BUSY;
        this._index = null;
        this.qwery = qwery || {
            filters: [],
            orders: [],
            limit: -1,
            offset: -1
        };
	}

	get state() {
		if ((this._state & F_ACTIVATE) === 0) {
			this._state |= F_ACTIVATE;
		}
		return this._state;
	}

    get index() {
		if (this._index === null) {
			this._index = this.space.subscribe(this.qwery);
		}

		return this._index;
	}

    get ok() {
		return (this.state & F_OK) !== 0;
	}

	get busy() {
		return (this.state & F_BUSY) !== 0;
	}

	get failed() {
		return (this.state & F_FAILED) !== 0;
	}

    get exists() {
		return (this.state & F_EXISTS) !== 0;
	}

	get length() {
		return this.index.length;
	}

    get items(): T[] {
		return this.index.all();
	}

	private next(key, mutator, data) {
		var fullKey = this.rootKey + ":" + key;

        if (!STREAMS.hasOwnProperty(fullKey)) {
			var q = this.qwery;

            STREAMS[key] = new Stream(this.space, key, {
                filters: q.filters.slice(0),
                orders: q.orders.slice(0),
                offset: q.offset,
                limit: q.limit,
			});

            mutator(STREAMS[key].qwery, data);
		}

        return STREAMS[key];
	}

    where(name: K, value: T[K]): Stream<T>;
    where(name: K, operator: Operator, value: T[K]): Stream<T>;
    where() {
        var name = arguments[0];
        var operator;
        var value;

		if (arguments.length === 3) {
            operator = arguments[1];
            value = arguments[2];
        } else {
            operator = '==';
            value = arguments[1];
		}

        return this.next(name + ":" + operator + ":" + value, nextQFilter, { name: name, operator: operator, value: value });
	}

    orderBy(name: K, direction: Direction): Stream<T> {
        return this.next(name + ":" + direction, nextQOrder, { name: name, direction: direction });
	}

    offset(val: number): this {
        this.qwery.offset = val;
        return this;
	}

    limit(val: number): this {
        this.qwery.limit = val;
        return this;
    }
}

export type IndexConfig<T> = {
    filter?: (item: T) => boolean;
    order?: QOrder<T>;
}

export class Index<T extends Entry> extends Emitter<T> {
    private _items: T[];
    private _index;
    private _comporator: Comparator<T>;
    private _filter;

	order: QOrder<T>;
    length: number;

	constructor(public name: keyof T, public cfg: IndexConfig<T> = {}) {
		super();

        this._items = [];
        this._index = {};
        this.length = 0;
        this.order = cfg.order || {
			name: name,
			direction: 'asc'
		};

        this._filter = cfg.filter || filterTrue;
        this._comporator = createComparator(this.order.name, this.order.direction);
	}

	all(): T[] {
        return this._items;
	}

    add(item: T) {
        if (!this._filter(item)) {
            return;
		}

		const idx = sortedIndexOf(this._items, item, this._comporator, this.length);

        if (idx < this.length) {
            this._items.splice(idx, 0, item);
        } else {
            this._items.push(item);
		}

        // this._index[item[this.name] as any] = item;
        this.length++;
        this.emitOnAdd(item, idx);
	}

    remove(item: T) {
		const idx = this._items.indexOf(item);

        if (idx > -1) {
            this._items.splice(idx, 1);
            // this._index[item[this.name] as any] = null;
            this.emitOnRemove(item, idx);
        }
	}

	linked(cfg: IndexConfig<T>): Index<T> {
		const newIndex = new Index(this.name, cfg);

        newIndex._items = this._items.filter((item) => {
            if (newIndex._filter(item)) {
                newIndex.length++;
                // newIndex._index[item[this.name] as any] = item;
                return true;
            }
		});

        this.onAdd((item) => {
            newIndex.add(item);
		});

        this.onRemove((item) => {
            newIndex.remove(item);
		});

        return newIndex;
	}

    reverse(): Index<T> {
        const newIndex = new Index(this.name, {
            filter: this._filter,
            order: {
                name: this.order.name,
                direction: this.order.direction === 'asc' ? 'desc' : 'asc'
            },
		});

        newIndex._items = this._items.slice(0).reverse();
        newIndex._index = this._index;
		newIndex.length = this.length;

        this.onAdd((item, idx) => {
            const newIdx = newIndex.length - idx;

			if (newIdx === 0) {
                newIndex._items.unshift(item);
            } else {
                newIndex._items.splice(newIdx, 0, item);
			}

            newIndex.length++;
            newIndex.emitOnAdd(item, newIdx);
		});

        this.onRemove((item, idx) => {
            newIndex.length--;
            newIndex._items.splice(newIndex.length - idx, 1);
            newIndex.emitOnRemove(item, newIndex.length - idx);
		});

        return newIndex;
    }
}

export class Space<T extends Entry, K extends keyof T = keyof T> {
	query: Stream<T>;

	private index = {} as {[name in K]: Index<T>};
	private indexes = [] as Index<T>[];

    constructor(public name: string, indexes: K[]) {
        this.query = new Stream(this, name);

		indexes.forEach((name) => {
			// Активируем индексы
            this.getIndex(name);
        });
	}

	get all() {
		return this.getIndex('id' as K).all();
	}

    getIndex(name: K) {
		if (!this.index.hasOwnProperty(name)) {
			const index = new Index<T>(name);

            this.index[name] = index;
            this.indexes.push(index);
		}

        return this.index[name];
	}

    subscribe(qwery: Qwery<T>) {
		let index = null;

        qwery.orders.forEach((o) => {
            if (index == null) {
				index = this.getIndex(o.name as K);

                if (o.direction !== index.order.direction) {
                    index = index.reverse();
                }
            }
		});

        if (qwery.filters.length) {
            if (index == null) {
                index = this.getIndex(qwery.filters[0].name as K);
			}

            index = index.linked({
                filter: createFilterFunction(qwery.filters),
                order: index.order,
            });
		}

        return index;
	}

    add(data: T): void {
		this.indexes.forEach((index) => {
            index.add(data);
        });
	}
}

export type Comparator<T> = (a: T, b: T) => number;

function createComparator<T>(prop: any, direction: Direction): Comparator<T> {
    return function comparator(a: T, b: T) {
        return simpleComporator(a[prop], b[prop]) * (direction === 'desc' ? -1 : 1);
    };
}

function sortedIndexOf(items, item, comparator, max) {
    var min = 0;
    var middle = -1;
    while (min < max) {
        middle = (min + max) / 2 | 0;
        switch (comparator(items[middle], item)) {
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

function simpleComporator(a: any, b: any): number {
    return a === b ? 0 : (a < b ? -1 : 1);
}

function stringComporator(a: string, b: string): number {
    return a === b ? 0 : a.localeCompare(b);
}

function filterTrue(): boolean {
    return true;
}

function createFilterFunction(filters: QFilter<any, any>[]) {
    const cond = filters.map((f) => `x.${f.name} ${f.operator} ${JSON.stringify(f.value)}`);
    return Function('x', `return ${cond.join('&&')}`);
}
