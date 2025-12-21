/// <reference types="jest" />
/// <reference types="node" />

import fs from 'node:fs';

import {
    ObjectInputStream, J, Serializable, Externalizable,
    TC_REFERENCE, TC_OBJECT, TC_NULL, TC_CLASSDESC, SC_SERIALIZABLE, TC_STRING, TC_BLOCKDATA, TC_ARRAY, TC_ENDBLOCKDATA, SC_WRITE_METHOD,
} from '../src/index';
import { EOFException, StreamCorruptedException, UTFDataFormatException } from '../src/exceptions';

const PATH_DIR = "tests/tmp";

function readExpectedFile(baseFilename: string): any[] {
    const data = fs.readFileSync(PATH_DIR + "/" + baseFilename + ".txt")
    return new TextDecoder()
        .decode(data)
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => eval("(" + line + ")"));
}

function readSerializedFile(baseFilename: string): Uint8Array {
    return fs.readFileSync(PATH_DIR + "/" + baseFilename + ".ser");
}

// Round a float64 to the closest float32
// Equivalent to (double)(float)d in Java
function toFloat32(d: number): number {
    return new Float32Array([d])[0];
}

const PRIMITIVES_FILENAME = "primitives"
test("sanity: primitives", () => {
    const ois = new ObjectInputStream(readSerializedFile(PRIMITIVES_FILENAME));

    expect(ois.readByte()   ).toBe(69)
    expect(ois.readChar()   ).toBe('✔')
    expect(ois.readDouble() ).toBe(420e69)
    expect(ois.readFloat()  ).toBe(toFloat32(-9e30))
    expect(ois.readInt()    ).toBe(420 * 69)
    expect(ois.readLong()   ).toBe(420n << (6n*9n))
    expect(ois.readShort()  ).toBe(-12345)
    expect(ois.readBoolean()).toBe(true)
})

const FLOATS_FILENAME = "floats"
test("float edge cases", () => {
    const ois = new ObjectInputStream(readSerializedFile(FLOATS_FILENAME));

    expect(ois.readFloat()).toBe(0.5);
    expect(ois.readFloat()).toBe(1_000_000);
    expect(Object.is(ois.readFloat(), +0)).toBeTruthy();
    expect(Object.is(ois.readFloat(), -0)).toBeTruthy();
    expect(ois.readFloat()).toBe(Infinity);
    expect(ois.readFloat()).toBe(-Infinity);
    expect(ois.readFloat()).toBeNaN();
    expect(ois.readFloat()).toBe(toFloat32(1e-40));

    expect(ois.readDouble()).toBe(0.5);
    expect(ois.readDouble()).toBe(1_000_000);
    expect(Object.is(ois.readDouble(), +0)).toBeTruthy();
    expect(Object.is(ois.readDouble(), -0)).toBeTruthy();
    expect(ois.readDouble()).toBe(Infinity);
    expect(ois.readDouble()).toBe(-Infinity);
    expect(ois.readDouble()).toBeNaN();
    expect(ois.readDouble()).toBe(1e-310);
})

const INT_LIMITS_FILENAME = "int-limits"
test("integer limits", () => {
    const ois = new ObjectInputStream(readSerializedFile(INT_LIMITS_FILENAME));

    expect(ois.readByte()).toBe(-1);
    expect(ois.readByte()).toBe(0);
    expect(ois.readByte()).toBe(1);
    expect(ois.readByte()).toBe(-Math.pow(2, 8-1));
    expect(ois.readByte()).toBe( Math.pow(2, 8-1) - 1);

    expect(ois.readChar()).toBe(String.fromCodePoint(0));
    expect(ois.readChar()).toBe(String.fromCodePoint(0x0000));
    expect(ois.readChar()).toBe(String.fromCodePoint(0xffff));
    expect(ois.readChar()).toBe(String.fromCodePoint(0xdc00));
    expect(ois.readChar()).toBe(String.fromCodePoint(0xdfff));
    expect(ois.readChar()).toBe(String.fromCodePoint(0xd800));
    expect(ois.readChar()).toBe(String.fromCodePoint(0xdbff));

    expect(ois.readInt()).toBe(-1);
    expect(ois.readInt()).toBe(0);
    expect(ois.readInt()).toBe(1);
    expect(ois.readInt()).toBe(-Math.pow(2, 32-1));
    expect(ois.readInt()).toBe( Math.pow(2, 32-1) - 1);

    expect(ois.readLong()).toBe(-1n);
    expect(ois.readLong()).toBe(0n);
    expect(ois.readLong()).toBe(1n);
    expect(ois.readLong()).toBe((-1n << (64n-1n)));
    expect(ois.readLong()).toBe(( 1n << (64n-1n)) - 1n);

    expect(ois.readShort()).toBe(-1);
    expect(ois.readShort()).toBe(0);
    expect(ois.readShort()).toBe(1);
    expect(ois.readShort()).toBe(-Math.pow(2, 16-1));
    expect(ois.readShort()).toBe( Math.pow(2, 16-1) - 1);
})

const PRIMITIVE_WRAPPERS_FILENAME = "primitive-wrappers";
test("primitive wrappers: with handlers", () => {
    const ois = new ObjectInputStream(readSerializedFile(PRIMITIVE_WRAPPERS_FILENAME));

    expect(ois.readObject()).toBe(5       );  // Byte
    expect(ois.readObject()).toBe('\u0005');  // Character
    expect(ois.readObject()).toBe(5       );  // Double
    expect(ois.readObject()).toBe(5       );  // Float
    expect(ois.readObject()).toBe(5       );  // Integer
    expect(ois.readObject()).toBe(5n      );  // Long
    expect(ois.readObject()).toBe(5       );  // Short
    expect(ois.readObject()).toBe(true    );  // Boolean
})

test("primitive wrappers: without handlers", () => {
    const ois = new ObjectInputStream(readSerializedFile(PRIMITIVE_WRAPPERS_FILENAME), {
        initialSerializables: new Map(),
    });

    expect(ois.readObject()).toMatchObject({value: 5       });  // Byte
    expect(ois.readObject()).toMatchObject({value: '\u0005'});  // Character
    expect(ois.readObject()).toMatchObject({value: 5       });  // Double
    expect(ois.readObject()).toMatchObject({value: 5       });  // Float
    expect(ois.readObject()).toMatchObject({value: 5       });  // Integer
    expect(ois.readObject()).toMatchObject({value: 5n      });  // Long
    expect(ois.readObject()).toMatchObject({value: 5       });  // Short
    expect(ois.readObject()).toMatchObject({value: true    });  // Boolean
})

const STRINGS_FILENAME = "strings";
test("strings", () => {
    const ois = new ObjectInputStream(readSerializedFile(STRINGS_FILENAME));

    const gigastring = Array.from({length: 0xffff+1}, (_, i) => String.fromCharCode(i)).join('');
    expect(gigastring.length).toBe(0xffff+1);

    expect(ois.readObject()).toBe("");
    expect(ois.readObject()).toBe("\0");
    expect(ois.readObject()).toBe("a".repeat(0xffff));
    expect(ois.readObject()).toBe("b".repeat(0xffff+1));
    expect(ois.readObject()).toBe(gigastring);
})

const ARRAYS_FILENAME = "arrays";
test("arrays", () => {
    const ois = new ObjectInputStream(readSerializedFile(ARRAYS_FILENAME), {
        initialSerializables: new Map(),  // No primitive wrapper handlers, to prove that values are actually primitive
    });

    // It's hard to test equality of classes that extend Array, because of jest quirks
    function javaArrayToJS(arr: any): any[] {
        if (!(arr instanceof J.Array)) return arr;
        return Array.from(arr, item => javaArrayToJS(item));
    }

    expect(javaArrayToJS(ois.readObject())).toEqual([]);

    const allBytes = Array.from({length: 256}, (_, i) => i-128);
    expect(javaArrayToJS(ois.readObject())).toEqual(allBytes);

    expect(javaArrayToJS(ois.readObject())).toEqual([[1,2,3], [4,5,6], [7,8,9]]);

    const a = {i: 1, obj: null};
    const b = {i: 2, obj: a};
    const c = {i: 3, obj: b};
    expect(javaArrayToJS(ois.readObject())).toMatchObject([a,b,c]);
})

function popHandle(obj: J.SerializableFallback): number {
    if (!Object.prototype.hasOwnProperty.call(obj, "$handle"))
        throw new Error("no $handle");
    const handle = obj.$handle;
    delete obj.$handle;
    return handle;
}

const OBJ_REF_FILENAME = "obj-ref-vs-eq";
test("object equality vs sameness", () => {
    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME));

    const obj1_1 = ois.readObject() as J.SerializableFallback;
    const obj2_1 = ois.readObject() as J.SerializableFallback;
    const obj1_2 = ois.readObject();
    const obj2_2 = ois.readObject();

    expect(obj1_1).toBeInstanceOf(J.SerializableFallback);
    expect(obj2_1).toBeInstanceOf(J.SerializableFallback);

    // The pairs are the same (===)
    expect(obj1_1).toBe(obj1_2);
    expect(obj2_1).toBe(obj2_2);

    // Save and delete handles to not mess with equality checks
    const handle1 = popHandle(obj1_1);
    const handle2 = popHandle(obj2_1);

    // Equal but not same between pairs
    expect(obj1_1).not.toBe(obj2_1);
    expect(obj1_1).toEqual(obj2_1);

    const obj1_after_reset = ois.readObject() as J.SerializableFallback;
    const handle_after_reset = popHandle(obj1_after_reset);

    // After reset, properly forgetting references
    expect(obj1_after_reset).not.toBe(obj1_1)
    expect(obj1_after_reset).toEqual(obj1_1)

    // View undocumented internal state to prove reset works properly
    expect(typeof handle1).toBe("number");
    expect(handle_after_reset).toBe(handle1);
})

const BLOCKS_FILENAME = "blocks"
test("block data edge cases", () => {
    const ois = new ObjectInputStream(readSerializedFile(BLOCKS_FILENAME));

    expect(ois.readInt()).toBe(0xdefaced);

    const obj1 = ois.readObject() as J.SerializableFallback;
    const obj2 = ois.readObject() as J.SerializableFallback;
    popHandle(obj1);
    popHandle(obj2);

    expect(obj1).toEqual(obj2);
    expect(obj1).not.toBe(obj2);
})

const CIRCULAR_FILENAME = "circular"
test("circular reference", () => {
    const ois = new ObjectInputStream(readSerializedFile(CIRCULAR_FILENAME));

    const obj = ois.readObject();
    expect(obj).toBeInstanceOf(J.SerializableFallback);
    expect((obj as any)?.obj).toBe(obj);
})

test.todo("eof after reset")


test.todo("classDesc gets handle before its object")  // The docs conflict on it, so must check

const HANDLERS_FILENAME = "handlers";
const CLASS_PREFIX = "com.o11k.GenerateTests$"
test("handlers behavior", () => {
    // @ts-expect-error
    const tell = (ois: ObjectInputStream) => ois.parser.offset;
    // @ts-expect-error
    const seek = (ois: ObjectInputStream, offset: number) => {ois.parser.offset = offset};

    class SerNoW implements Serializable {
        i: number; constructor(i=0) {this.i = i;}
    }
    class SerW implements Serializable {
        i: number; constructor(i=0) {this.i = i;}
        writeObject(ois: ObjectInputStream) {ois.defaultReadObject();}
    }
    class EmptySerW implements Serializable {readObject(_ois: ObjectInputStream) {}}
    class SerWExtra implements Serializable {
        i: number; constructor(i=0) {this.i = i;}
        readObject(ois: ObjectInputStream) {
            ois.defaultReadObject();
            // Extra is read implicitly
        }
    }
    class SerWNoFields implements Serializable {
        i_in_js: number; constructor(i=0) {this.i_in_js = i;}
        readObject(ois: ObjectInputStream) {this.i_in_js = ois.readInt();}
    }
    class SerWMisplacedFields implements Serializable {
        i: number; constructor(i=0) {this.i = i;}
        readObject(ois: ObjectInputStream) {
            expect(ois.readInt()).toBe(123);
            ois.defaultReadObject();
            expect(ois.readInt()).toBe(456);
        }
    }
    class ExtParent implements Externalizable {
        readExternal(ois: ObjectInputStream) {
            throw new Error("This should never run")
        }
    }
    class ExtChild extends ExtParent {
        i_in_js: number; constructor(i=0) {super(); this.i_in_js = i;}
        readExternal(ois: ObjectInputStream) {
            this.i_in_js = ois.readInt();
            expect(ois.readUTF()).toBe("testicle");
        }
    }

    const oisHandlers = new ObjectInputStream(readSerializedFile(HANDLERS_FILENAME))
    oisHandlers.registerSerializable(CLASS_PREFIX+"SerNoW", SerNoW);
    oisHandlers.registerSerializable(CLASS_PREFIX+"SerW", SerW);
    oisHandlers.registerSerializable(CLASS_PREFIX+"EmptySerW", EmptySerW);
    oisHandlers.registerSerializable(CLASS_PREFIX+"SerWExtra", SerWExtra);
    oisHandlers.registerSerializable(CLASS_PREFIX+"SerWNoFields", SerWNoFields);
    oisHandlers.registerSerializable(CLASS_PREFIX+"SerWMisplacedFields", SerWMisplacedFields);
    oisHandlers.registerExternalizable(CLASS_PREFIX+"ExtParent", ExtParent);
    oisHandlers.registerExternalizable(CLASS_PREFIX+"ExtChild", ExtChild);

    expect(oisHandlers.readObject()).toEqual(new SerNoW(1));
    expect(oisHandlers.readObject()).toEqual(new SerW(2));

    jest.spyOn(EmptySerW.prototype, "readObject");
    expect(oisHandlers.readObject()).toEqual(new SerWExtra(3));
    expect(EmptySerW.prototype.readObject).toHaveBeenCalled();
    jest.clearAllMocks();
    
    expect(oisHandlers.readObject()).toEqual(new SerWNoFields(4));
    const afterSerWNoFields = tell(oisHandlers);
    expect(oisHandlers.readObject()).toEqual(new SerWMisplacedFields(5));
    const afterSerWMisplacedFields = tell(oisHandlers);
    expect(oisHandlers.readObject()).toEqual(new ExtChild(6));
    // expect(oosHandlers.readObject()).toEqual(new ExtChild(7));  // TODO
    
    const oisNoHandlers = new ObjectInputStream(readSerializedFile(HANDLERS_FILENAME));
    oisNoHandlers.registerSerializable(CLASS_PREFIX+"EmptySerW", EmptySerW);  // Registered only to check if parsed
    
    expect(oisNoHandlers.readObject()).toMatchObject({i: 1, $classDesc: {className: CLASS_PREFIX+"SerNoW"}});
    expect(oisNoHandlers.readObject()).toMatchObject({i: 2, $classDesc: {className: CLASS_PREFIX+"SerW"}});
    
    jest.spyOn(EmptySerW.prototype, "readObject");
    expect(oisNoHandlers.readObject()).toMatchObject({i: 3, $classDesc: {className: CLASS_PREFIX+"SerWExtra"}});
    expect(EmptySerW.prototype.readObject).toHaveBeenCalled();
    jest.clearAllMocks();

    expect(() => oisNoHandlers.readObject()).toThrow(StreamCorruptedException);
    seek(oisNoHandlers, afterSerWNoFields);

    expect(() => oisNoHandlers.readObject()).toThrow(StreamCorruptedException);
    seek(oisNoHandlers, afterSerWMisplacedFields);

    const externalizable = oisNoHandlers.readObject() as J.ExternalizableFallback;
    expect(externalizable).toMatchObject({classDesc: {className: CLASS_PREFIX+"ExtChild"}});
    expect(externalizable.annotations.length).toBe(2);
    expect(new Uint8Array(externalizable.annotations[0] as J.BlockData)).toEqual(new Uint8Array([
        0,0,0,6,
        0,"testicle".length,
        ...new TextEncoder().encode("testicle"),
    ]))
    expect(externalizable.annotations[1]).toEqual(new EmptySerW())
})

// User errors

test.todo("readFields twice")
test.todo("readFields outside readObject")
test.todo("readFields inside readExternal")
test.todo("readObject where fields aren't in the start, without handler")  // Can corrupt stream
// test("externalizable without readExternal")  // ts prevents that?
test.todo("externalizable PROTOCOL_VERSION_1 without handler")
test.todo("unmatching serialVersionUID")
test.todo("serializable reading too much")
test.todo("externalizable reading too much")
test.todo("externalizable PROTOCOL_VERSION_1 reading too much")  // Corrupts stream
test.todo("read too much")  // primitive + object cases
test.todo("readObject when in block")
test.todo("read[primitive] when not in block")
test.todo("serializable parent class in java but not js")
test.todo("readResolve circular reference")
test.todo("readResolve multiple handles")  // unrealistic condition

// Errors in stream

test("empty file", () => {
    expect(() => new ObjectInputStream(new Uint8Array([]))).toThrow(EOFException);
})

test("corruped STREAM_MAGIC or STREAM_VERSION", () => {
    // Correct
    new ObjectInputStream(new Uint8Array([0xac, 0xed, 0x00, 0x05]));

    expect(() => new ObjectInputStream(new Uint8Array([0xac, 0xee]))).toThrow(StreamCorruptedException);
    expect(() => new ObjectInputStream(new Uint8Array([0xac, 0xed]))).toThrow(EOFException);
    expect(() => new ObjectInputStream(new Uint8Array([0xac, 0xed, 0x00]))).toThrow(EOFException);
    expect(() => new ObjectInputStream(new Uint8Array([0xac, 0xed, 0x00, 0x04]))).toThrow(StreamCorruptedException);
})

test("unknown TC", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        0x69,                    // Unknown TC
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
    expect(() => ois.readInt()).toThrow(StreamCorruptedException);
})

test("prevObject doesnt exist", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        TC_REFERENCE,
        0x69, 0x69, 0x69, 0x69,  // Bad reference
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})

test("utf-8 error", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        TC_STRING,
        0x00, 0x02,
        'A'.charCodeAt(0), 0b1010_1010,
    ]));
    expect(() => ois.readObject()).toThrow(UTFDataFormatException);

    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        TC_STRING,
        0x00, 0x02,
        'A'.charCodeAt(0), "B".charCodeAt(0),
    ]));
    expect(ois2.readObject()).toBe("AB");
})

test("object with null classDesc", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        TC_OBJECT,
        TC_NULL,
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})

test("not serializable and not externalizable", () => {
    // Doesn't work with flags = 0
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_OBJECT,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        0x00,                                            // flags (nothing)
        0x00, 0x00, TC_ENDBLOCKDATA, TC_NULL
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);

    // Works with flags = SC_SERIALIZABLE
    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_OBJECT,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        SC_SERIALIZABLE,
        0x00, 0x00, TC_ENDBLOCKDATA, TC_NULL
    ]));
    expect(() => ois2.readObject()).not.toThrow();
})

test("annotations without TC_ENDBLOCKDATA", () => {
    // Object: will read entire stream until EOF
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_OBJECT,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        SC_SERIALIZABLE | SC_WRITE_METHOD,
        0x00, 0x00, TC_ENDBLOCKDATA, TC_NULL,

        TC_BLOCKDATA, 0x01, 0x69,                        // Random block, will be interpreted as annotation
    ]));
    expect(() => ois.readObject()).toThrow(EOFException);

    // Class: will throw stream corrupted
    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_OBJECT,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        SC_SERIALIZABLE | SC_WRITE_METHOD,
        0x00, 0x01,
        'I'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0),
        TC_NULL, // TC_ENDBLOCKDATA,                     // annotations=[null], then no end block
        TC_NULL,
        0x69, 0x69, 0x69, 0x69,                          // field i=0x69696969
        TC_BLOCKDATA, 0x01, 0x69,                        // Random block, will be interpreted as annotation
    ]));
    expect(() => ois2.readObject()).toThrow(StreamCorruptedException);
})

test("bad field typecode", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_OBJECT,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        SC_SERIALIZABLE,
        0x00, 0x01,
        'X'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0), // Field "i" with typecode X
        TC_ENDBLOCKDATA, TC_NULL,
        0x69, 0x69, 0x69, 0x69, 0x69, 0x69, 0x69, 0x69,
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})

test("bad array classDesc", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_ARRAY,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        SC_SERIALIZABLE,
        0x00, 0x01,
        'I'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0),
        TC_ENDBLOCKDATA, TC_NULL,
        0x00, 0x00, 0x00, 0x00                           // size = 0
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})

test("eof in middle of primitive / object", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,    // Header
        TC_BLOCKDATA, 0x03,
        0x69, 0x69, 0x69, // an int requires 1 more byte
    ]));
    expect(() => ois.readInt()).toThrow(EOFException);

    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        TC_OBJECT,
        TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        SC_SERIALIZABLE,
        0x00, 0x01,
        'I'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0),
        TC_ENDBLOCKDATA, TC_NULL,
        0x69, // expecting 3 more bytes for field "int i"
    ]));
    expect(() => ois2.readObject()).toThrow(EOFException);
})

// TODO enums
// TODO classes and classDescs
// TODO sudden death: a million random objects and primitives that reference each other
