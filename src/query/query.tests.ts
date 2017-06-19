import Observer, {autorun} from '../Observer/Observer';
import observable from '../observable/observable';
import query from './query';

const sequence = [{id: 1}, {id: '1'}, {id: 2}, {id: 3}];

it('where: id == 1', () => {
	const array = sequence.slice(0);
	expect(query.where('id', 1)(array)[0]).toBe(array[0]);
});

it('where: id === "1"', () => {
	const array = sequence.slice(0);

	expect(query.where('id', '===', '1')(array)[0]).toBe(array[1]);
});

it('where: id > 1', () => {
	const array = sequence.slice(0);
	expect(query.where('id', '>', 1)(array)).toEqual(array.slice(2));
});

it('streams', () => {
	const array = sequence.slice(0);
	let stream;

	autorun(() => {
		stream = query.where('id', '>=', 123)(array);
	});

	expect(stream[0]).toBe(void 0);

	array.push({id: 123});
	expect(stream[0]).toEqual({id: 123});
	expect(stream.length).toBe(1);

	array.push({id: 321});
	expect(stream.length).toBe(2);

	array.push({id: 333});
	expect(stream.length).toBe(3);
});

it('streams: invalidate', () => {
	const array = sequence.slice(0);
	const stream = query.where('id', '>=', 123)(array);

	expect(stream[0]).toBe(void 0);

	array.push({id: 123});
	expect(stream[0]).toEqual({id: 123});
	expect(stream.length).toBe(1);

	array.push({id: 321});
	expect(stream.length).toBe(2);

	array.push({id: 333});
	expect(stream.length).toBe(2);
});

test('observers: subscribe/unsubscribe', () => {
	const foo = [];
	const log = [];

	const renderElse = Observer.wrap(() => {
		log.push('renderElse');
	});

	const renderFoo = Observer.wrap((item) => {
		log.push(`renderFoo:${item.id}:${item.value}`);
	});

	autorun(() => {
		const fooItem = query.where('id', 123)(foo)[0];
		const stopItem = query.where('id', 3)(foo)[0];
		
		log.push(`fooItem:${!!fooItem}`);

		if (fooItem && !stopItem) {
			renderFoo(fooItem);
		} else {
			renderElse();
		}
	});

	expect(log.join('->')).toBe('fooItem:false->renderElse');

	log.length = 0;
	foo.push({id: 2});
	expect(log.join('->')).toBe('');

	log.length = 0;
	foo.push({id: 123, value: 'foo'});
	expect(log.join('->')).toBe('fooItem:true->renderFoo:123:foo');

	log.length = 0;
	foo[1].value = 'bar';
	expect(log.join('->')).toBe('renderFoo:123:bar');

	log.length = 0;
	foo.push({id: 3});
	expect(log.join('->')).toBe('fooItem:true->renderElse');

	log.length = 0;
	foo[1].value = 'baz';
	expect(log.join('->')).toBe('renderFoo:123:baz');

	log.length = 0;
	foo[1].id = -1;
	// todo: Вопрос, а должен ли быть `renderFoo:-1:baz->` или всё же считать этот код мёртвым?
	expect(log.join('->')).toBe('renderFoo:-1:baz->fooItem:false->renderElse');
});

it('observeble: array', () => {
	const log = [];
	const arr = observable<{id: number, completed: boolean}[]>([{id: 123, completed: true}]);
	const renderItem = Observer.wrap((data) => {
		log.push(`item:${data.id}:${data.completed}`);
	});

	autorun(() => {
		log.push(`autorun:${arr[0].id}`);
		arr.forEach(renderItem);
	});

	expect(log.join('->')).toBe('autorun:123->item:123:true');

	log.length = 0;
	arr[0].completed = false;
	expect(log.join('->')).toBe('item:123:false');

	log.length = 0;
	arr[0].id = 321;
	expect(log.join('->')).toBe('autorun:321->item:321:false');
});

it('replace array', () => {
	const log = [];
	const store = observable<{arr: {id: number, completed: boolean}[]}>({
		arr: [{id: 123, completed: true}]
	});

	autorun(() => {
		log.push('length:' + store.arr.length);
	});

	expect(log.join('->')).toBe('length:1');

	log.length = 0;
	store.arr = [];
	expect(log.join('->')).toBe('length:0');
});
