import Observer from './Observer';

it('onnotify', () => {
	let cid = 0;
	let log = [];

	const observer = new Observer(() => {
		return ++cid;
	}, {
		onnotify(val) {
			log.push(val);
		}
	});

	observer.notify();
	observer.notify();
	observer.notify();

	expect(log).toEqual([1, 2, 3]);
});
