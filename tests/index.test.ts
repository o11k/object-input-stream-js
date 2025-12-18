/// <reference types="jest" />
/// <reference types="node" />

import fs from 'node:fs';

import { ObjectInputStream, J } from '../src/index';

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

const PRIMITIVE_ARR_FILENAME = "array-primitive";
test("array of primitives", () => {
    const ois = new ObjectInputStream(readSerializedFile(PRIMITIVE_ARR_FILENAME), {
        initialSerializables: new Map(),  // No primitive wrapper handlers, to prove that values are actually primitive
    });

    const expected = Array.from({length: 256}, (_, i) => i-128);
    const found = ois.readObject() as J.Array;

    expect(found instanceof J.Array).toBeTruthy();
    expect(Array.from(found)).toEqual(expected);
})

const ARR_2D_FILENAME = "array-2d";
test("2d array", () => {
    const ois = new ObjectInputStream(readSerializedFile(ARR_2D_FILENAME));

    const expected = [[1,2,3], [4,5,6], [7,8,9]];
    const found = Array.from(ois.readObject() as J.Array, item => Array.from(item));

    expect(found).toEqual(expected);
})

const OBJ_REF_FILENAME = "obj-ref-vs-eq";
test("object equality vs sameness", () => {
    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME));

    const obj1_1 = ois.readObject();
    const obj2_1 = ois.readObject();
    const obj1_2 = ois.readObject();
    const obj2_2 = ois.readObject();

    expect(obj1_1).not.toBeNull();
    expect(obj2_1).not.toBeNull();

    // The pairs are the same (===)
    expect(obj1_1).toBe(obj1_2);
    expect(obj2_1).toBe(obj2_2);

    // Equal but not same between pairs
    // @ts-expect-error
    obj2_1!.$handle = obj1_1!.$handle;  // They only differ in handle, so solve it
    expect(obj1_1).not.toBe(obj2_1);
    expect(obj1_1).toMatchObject(obj2_1!);

    // After reset, properly forgetting references
    const obj1_after_reset = ois.readObject();
    expect(obj1_after_reset).not.toBe(obj1_1)
    expect(obj1_after_reset).toEqual(obj1_1)

    // View undocumented internal state to prove reset works properly
    const handle1 = (obj1_1           as any).$handle;
    const handle2 = (obj1_after_reset as any).$handle;
    expect(typeof handle1).toBe("number");
    expect(handle1).toBe(handle2);
})

test.todo("0-length blocks before object")
test.todo("0-length blocks before block")
test.todo("primitive crossing block boundaries")
test.todo("circular reference")
test.todo("multiple resets")
test.todo("eof after reset")


// Object tests
// Each with + without handler?

test.todo("serializable without writeObject")
test.todo("serializable with writeObject")
test.todo("writeObject that doesn't read all annotations")
test.todo("writeObject that doesn't read fields")
test.todo("writeObject that reads fields after annotations")  // Without handler == error
test.todo("readExternal isn't called on parent classes")
test.todo("classDesc gets handler before its object")  // The docs conflict on it, so must check

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

// Errors in stream

test.todo("utf-8 error")
test.todo("prevObject doesn't exist")
test.todo("replaceObject multiple handles")  // unrealistic condition
test.todo("empty file")
test.todo("corruped STREAM_MAGIC or STREAM_VERSION")
test.todo("unknown TC")
test.todo("object with null classDesc")
test.todo("not serializable and not externalizable")
test.todo("annotations without TC_ENDBLOCKDATA")
test.todo("bad field typecode")
test.todo("bad array classDesc")
test.todo("eof in middle of primitive / object")

// TODO enums
// TODO classes and classDescs
