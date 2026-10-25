import { describe, it } from 'vitest';
import { string2UrlQueryCodec } from '../src/urlquery/ast';
import { expectOk } from './assertions';

describe('string2UrlQueryCodec', () => {
  it('deserialises a simple query string', () => {
    expectOk(string2UrlQueryCodec.deserialise('foo=bar&baz=qux')).toStrictEqual({ foo: 'bar', baz: 'qux' });
  });

  it('handles repeated keys as arrays', () => {
     expectOk(string2UrlQueryCodec.deserialise('a=1&a=2&a=3')).toStrictEqual({ a: ['1', '2', '3'] });
  });

  it('serialises and deserialises roundtrip', () => {
    const original = { foo: 'bar', a: ['1', '2'] };
    const str = string2UrlQueryCodec.serialise(original);
    expectOk(string2UrlQueryCodec.deserialise(str)).toStrictEqual(original);
  });
});
