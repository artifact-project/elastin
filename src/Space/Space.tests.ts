import { Space } from "./Space";

type TestEntry = {
    id: number;
    value: string;
}

it('space.add', () => {
    const space = new Space<TestEntry>('test', ['id']);

    space.add({ id: 1, value: 'first' });
    expect(space.all.length).toBe(1);

    space.add({ id: 3, value: 'third' });
    expect(space.all.length).toBe(2);
    expect(space.all[1].id).toBe(3);

    space.add({ id: 2, value: 'second' });
    expect(space.all.length).toBe(3);
    expect(space.all[1].id).toBe(2);
});

it('space.stream', () => {
    const space = new Space<TestEntry>('test', ['id']);
    const idStream = space.query.where('id', '>', 1).orderBy('id', 'desc');

    expect(idStream.busy).toBe(true);

    space.add({ id: 1, value: 'first' });
    expect(idStream.length).toBe(0);

    space.add({ id: 3, value: 'third' });
    expect(idStream.length).toBe(1);

    space.add({ id: 2, value: 'second' });
    expect(idStream.length).toBe(2);
    expect(idStream.items[0].id).toBe(3);
});
