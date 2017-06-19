import observable from './observable';

it('observable: {}', () => {
	const item = observable({});

	expect(!!item['emit']).toBe(true);
});

it('observable: []', () => {
	const items = observable([]);

	expect(!!items['emit']).toBe(true);
});
