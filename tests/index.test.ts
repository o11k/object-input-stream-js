/// <reference types="jest" />
/// <reference types="node" />

import fs from 'node:fs';

import {
    ObjectInputStream, Serializable, Externalizable, internal,
    ObjectInputStreamAST,
    ast
} from '../src/index';
import { EOFException, InvalidClassException, NullPointerException, StreamCorruptedException, UTFDataFormatException } from '../src/exceptions';

// For constants
const c = ObjectInputStream;

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
        initialClasses: {serializable: new Map()},
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
        initialClasses: {serializable: new Map()},  // No primitive wrapper handlers, to prove that values are actually primitive
    });

    expect(ois.readObject()).toEqual([]);

    const allBytes = Array.from({length: 256}, (_, i) => i-128);
    expect(ois.readObject()).toEqual(allBytes);

    expect(ois.readObject()).toEqual([[1,2,3], [4,5,6], [7,8,9]]);

    const a = {i: 1, obj: null};
    const b = {i: 2, obj: a};
    const c = {i: 3, obj: b};
    expect(ois.readObject()).toMatchObject([a,b,c]);
})

const OBJ_REF_FILENAME = "obj-ref-vs-eq";
test("object equality vs sameness", () => {
    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME));

    const obj1_1 = ois.readObject();
    const obj2_1 = ois.readObject();
    const obj1_2 = ois.readObject();
    const obj2_2 = ois.readObject();

    expect(obj1_1).toBeInstanceOf(internal.BaseFallbackSerializable);
    expect(obj2_1).toBeInstanceOf(internal.BaseFallbackSerializable);

    // The pairs are the same (===)
    expect(obj1_1).toBe(obj1_2);
    expect(obj2_1).toBe(obj2_2);

    // Equal but not same between pairs
    expect(obj1_1).not.toBe(obj2_1);
    expect(obj1_1).toEqual(obj2_1);

    const obj1_after_reset = ois.readObject();

    // After reset, properly forgetting references
    expect(obj1_after_reset).not.toBe(obj1_1)
    expect(obj1_after_reset).toEqual(obj1_1)
})

const BLOCKS_FILENAME = "blocks"
test("block data edge cases", () => {
    const ois = new ObjectInputStream(readSerializedFile(BLOCKS_FILENAME));

    expect(ois.readInt()).toBe(0xdefaced);

    const obj1 = ois.readObject();
    const obj2 = ois.readObject();

    expect(obj1).toEqual(obj2);
    expect(obj1).not.toBe(obj2);
})

const CIRCULAR_FILENAME = "circular"
test("circular reference", () => {
    const ois = new ObjectInputStream(readSerializedFile(CIRCULAR_FILENAME));

    const obj = ois.readObject();
    expect(obj).toBeInstanceOf(internal.BaseFallbackSerializable);
    expect((obj as any)?.obj).toBe(obj);
})

test.todo("eof after reset")


test.todo("classDesc gets handle before its object")  // The docs conflict on it, so must check


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
        expect(ois.readObject()).toBeInstanceOf(EmptySerW);
    }
}


const HANDLERS_FILENAME = "handlers";
const CLASS_PREFIX = "com.o11k.GenerateTests$"
test("handlers behavior", () => {
    // @ts-expect-error
    const tell = (ois: ObjectInputStream) => ois.offset;
    // @ts-expect-error
    const seek = (ois: ObjectInputStream, offset: number) => {ois.offset = offset};

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
    expect(oisHandlers.readObject()).toEqual(new ExtChild(7));

    const oisNoHandlers = new ObjectInputStream(readSerializedFile(HANDLERS_FILENAME));
    oisNoHandlers.registerSerializable(CLASS_PREFIX+"EmptySerW", EmptySerW);  // Registered only to check if parsed

    const obj_SerNoW = oisNoHandlers.readObject();
    expect(obj_SerNoW).toMatchObject({i: 1});
    expect(Object.getPrototypeOf(obj_SerNoW).constructor.$desc).toMatchObject({name: CLASS_PREFIX+"SerNoW"});

    const obj_SerW = oisNoHandlers.readObject();
    expect(obj_SerW).toMatchObject({i: 2});
    expect(Object.getPrototypeOf(obj_SerW).constructor.$desc).toMatchObject({name: CLASS_PREFIX+"SerW"});

    jest.spyOn(EmptySerW.prototype, "readObject");
    const obj_SerWExtra = oisNoHandlers.readObject();
    expect(obj_SerWExtra).toMatchObject({i: 3});
    expect(Object.getPrototypeOf(obj_SerWExtra).constructor.$desc).toMatchObject({name: CLASS_PREFIX+"SerWExtra"});
    expect(EmptySerW.prototype.readObject).toHaveBeenCalled();
    jest.clearAllMocks();

    expect(() => oisNoHandlers.readObject()).toThrow(StreamCorruptedException);
    seek(oisNoHandlers, afterSerWNoFields);

    expect(() => oisNoHandlers.readObject()).toThrow(StreamCorruptedException);
    seek(oisNoHandlers, afterSerWMisplacedFields);

    const externalizable = oisNoHandlers.readObject() as internal.BaseFallbackExternalizable;
    expect(Object.getPrototypeOf(externalizable).constructor.$desc).toMatchObject({name: CLASS_PREFIX+"ExtChild"});
    expect(externalizable.$annotation.length).toBe(2);
    expect(new Uint8Array(externalizable.$annotation[0])).toEqual(new Uint8Array([
        0,0,0,6,
        0,"testicle".length,
        ...new TextEncoder().encode("testicle"),
    ]))
    expect(externalizable.$annotation[1]).toEqual(new EmptySerW())
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
        c.TC_REFERENCE,
        0x69, 0x69, 0x69, 0x69,  // Bad reference
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})

test("utf-8 error", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        c.TC_STRING,
        0x00, 0x02,
        'A'.charCodeAt(0), 0b1010_1010,
    ]));
    expect(() => ois.readObject()).toThrow(UTFDataFormatException);

    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        c.TC_STRING,
        0x00, 0x02,
        'A'.charCodeAt(0), "B".charCodeAt(0),
    ]));
    expect(ois2.readObject()).toBe("AB");
})

test("object with null classDesc", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,  // Header
        c.TC_OBJECT,
        c.TC_NULL,
    ]));
    expect(() => ois.readObject()).toThrow(NullPointerException);
})

test("not serializable and not externalizable", () => {
    // Doesn't work with flags = 0
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_OBJECT,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        0x00,                                            // flags (nothing)
        0x00, 0x00, c.TC_ENDBLOCKDATA, c.TC_NULL
    ]));
    expect(() => ois.readObject()).toThrow(InvalidClassException);

    // Works with flags = c.SC_SERIALIZABLE
    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_OBJECT,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        c.SC_SERIALIZABLE,
        0x00, 0x00, c.TC_ENDBLOCKDATA, c.TC_NULL
    ]));
    expect(() => ois2.readObject()).not.toThrow();
})

test("annotations without c.TC_ENDBLOCKDATA", () => {
    // Object: will read entire stream until EOF
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_OBJECT,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        c.SC_SERIALIZABLE | c.SC_WRITE_METHOD,
        0x00, 0x00, c.TC_ENDBLOCKDATA, c.TC_NULL,

        c.TC_BLOCKDATA, 0x01, 0x69,                        // Random block, will be interpreted as annotation
    ]));
    expect(() => ois.readObject()).toThrow(EOFException);

    // Class: will throw stream corrupted
    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_OBJECT,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        c.SC_SERIALIZABLE | c.SC_WRITE_METHOD,
        0x00, 0x01,
        'I'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0),
        c.TC_NULL, // c.TC_ENDBLOCKDATA,                     // annotations=[null], then no end block
        c.TC_NULL,
        0x69, 0x69, 0x69, 0x69,                          // field i=0x69696969
        c.TC_BLOCKDATA, 0x01, 0x69,                        // Random block, will be interpreted as annotation
    ]));
    expect(() => ois2.readObject()).toThrow(StreamCorruptedException);
})

test("bad field typecode", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_OBJECT,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        c.SC_SERIALIZABLE,
        0x00, 0x01,
        'X'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0), // Field "i" with typecode X
        c.TC_ENDBLOCKDATA, c.TC_NULL,
        0x69, 0x69, 0x69, 0x69, 0x69, 0x69, 0x69, 0x69,
    ]));
    expect(() => ois.readObject()).toThrow(InvalidClassException);
})

test("bad array classDesc", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_ARRAY,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        c.SC_SERIALIZABLE,
        0x00, 0x01,
        'I'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0),
        c.TC_ENDBLOCKDATA, c.TC_NULL,
        0x00, 0x00, 0x00, 0x00                           // size = 0
    ]));
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})

test("eof in middle of primitive / object", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,    // Header
        c.TC_BLOCKDATA, 0x03,
        0x69, 0x69, 0x69, // an int requires 1 more byte
    ]));
    expect(() => ois.readInt()).toThrow(EOFException);

    const ois2 = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,                          // Header
        c.TC_OBJECT,
        c.TC_CLASSDESC,
        0x00, 0x01, 'A'.charCodeAt(0),                   // Class name "A"
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // serialVersionUID
        c.SC_SERIALIZABLE,
        0x00, 0x01,
        'I'.charCodeAt(0), 0x00, 0x01, 'i'.charCodeAt(0),
        c.TC_ENDBLOCKDATA, c.TC_NULL,
        0x69, // expecting 3 more bytes for field "int i"
    ]));
    expect(() => ois2.readObject()).toThrow(EOFException);
})


// withOos("primitives", GenerateTests::genPrimitives);
// withOos("floats", GenerateTests::genFloats);
// withOos("int-limits", GenerateTests::genIntLimits);
// withOos("primitive-wrappers", GenerateTests::genPrimitiveWrappers);
// withOos("strings", GenerateTests::genStrings);
// withOos("arrays", GenerateTests::genArrays);
// withOos("obj-ref-vs-eq", GenerateTests::genObjRef);
// genBlockEdgeCases("blocks");
// withOos("circular", GenerateTests::genCircular);
// withOos("handlers", GenerateTests::genHandlers);

function testAst(filename: string, structure: any, run=(ois: ObjectInputStreamAST)=>{}) {
    const ois = new ObjectInputStreamAST(readSerializedFile(filename));
    run(ois);
    ois.readEverything();
    const astRoot = ois.getAST().root;
    expect(astRoot).toMatchObject(structure)

    // function pp(node: ast.Node, indent=0) {
    //     let res = " ".repeat(indent) + node.type;
    //     if ((node as any).value !== undefined) res += ": " + (node as any).value;
    //     if (node.children !== null && node.children.length > 0)
    //         res += "\n" + node.children.map(c => pp(c,indent+1)).join("\n")
    //     return res;
    // }

    // console.log(pp(astRoot))
}

test("ast: primitives", () => {
    testAst(PRIMITIVES_FILENAME, {children: [{},{},{children: [
        {type: "blockdata-sequence", children: [
            {type: "blockdata"}
        ]},
    ]}]});
})


test("ast: primitive wrappers", () => {
    testAst(PRIMITIVE_WRAPPERS_FILENAME, {children: [{},{},{children: [
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [{}, {type: "class-data", children: [{}, {type: "values", children: [{value: 5       }]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [    {type: "class-data", children: [{}, {type: "values", children: [{value: '\u0005'}]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [{}, {type: "class-data", children: [{}, {type: "values", children: [{value: 5       }]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [{}, {type: "class-data", children: [{}, {type: "values", children: [{value: 5       }]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [{}, {type: "class-data", children: [{}, {type: "values", children: [{value: 5       }]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [{}, {type: "class-data", children: [{}, {type: "values", children: [{value: 5n      }]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [{}, {type: "class-data", children: [{}, {type: "values", children: [{value: 5       }]}]}]}]},
        {objectType: "new-object", children: [{value: c.TC_OBJECT}, {}, {type: "serial-data", children: [    {type: "class-data", children: [{}, {type: "values", children: [{value: true    }]}]}]}]},
    ]}]});
})

test("ast: arrays", () => {
    testAst(ARRAYS_FILENAME, {children: [{},{},{children: [
        {objectType: "new-array", children: [{},{},{value: 0  },{}]},
        {objectType: "new-array", children: [{},{},{value: 256},{
            children: Array.from({length: 256}, (_item, index) => ({type: "primitive", dataType: "byte", value: index-128}))
        }]},
        {objectType: "new-array", children: [{},{},{value: 3  },{children: [
            {objectType: "new-array", children: [{},{},{value: 3},{children: [{value: 1}, {value: 2}, {value: 3}]}]},
            {objectType: "new-array", children: [{},{},{value: 3},{children: [{value: 4}, {value: 5}, {value: 6}]}]},
            {objectType: "new-array", children: [{},{},{value: 3},{children: [{value: 7}, {value: 8}, {value: 9}]}]},
        ]}]},
        {objectType: "new-array", children: [{},{},{value: 3  },{children: [{},{},{}]}]},
    ]}]});
})

test("ast: blocks", () => {
    testAst(BLOCKS_FILENAME, {children: [{},{},{children: [
        {type: "blockdata-sequence", children: [
            {children: [{},{value: 0},{}]},
            {children: [{},{value: 1},{}]},
            {children: [{},{value: 0},{}]},
            {children: [{},{value: 0},{}]},
            {children: [{},{value: 2},{}]},
            {children: [{},{value: 1},{}]},
        ]},
        {objectType: "new-object"},
        {type: "blockdata-sequence", children: [{},{},{}]},
        {objectType: "new-object"},
    ]}]});
})

test("ast: handlers", () => {
    testAst(HANDLERS_FILENAME, {children: [{},{},{children: [
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"SerNoW"             },{},{}]},{}]},
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"SerW"               },{},{}]},{}]},
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"SerWExtra"          },{},{}]},{}]},
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"SerWNoFields"       },{},{}]},{}]},
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"SerWMisplacedFields"},{},{}]},{}]},
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"ExtChild"           },{},{}]},{}]},
        {objectType: "reset"},
        {objectType: "new-object", children: [{},{children: [{},{value: CLASS_PREFIX+"ExtChild"           },{},{}]},{}]},
    ]}]}, (ois) => {
        ois.registerSerializable(CLASS_PREFIX+"SerNoW", SerNoW);
        ois.registerSerializable(CLASS_PREFIX+"SerW", SerW);
        ois.registerSerializable(CLASS_PREFIX+"EmptySerW", EmptySerW);
        ois.registerSerializable(CLASS_PREFIX+"SerWExtra", SerWExtra);
        ois.registerSerializable(CLASS_PREFIX+"SerWNoFields", SerWNoFields);
        ois.registerSerializable(CLASS_PREFIX+"SerWMisplacedFields", SerWMisplacedFields);
        ois.registerExternalizable(CLASS_PREFIX+"ExtParent", ExtParent);
        ois.registerExternalizable(CLASS_PREFIX+"ExtChild", ExtChild);
    })
})

// readObject is called even if not SC_WRITE_METHOD
// header      class A   suid=0 Serializable int x              "kaki"           x=69
// aced0005 73 72 000141 0000000000000000 02 000149000178 78 70 770600046b616b69 00000045

// multiple resets before / after / betweem objects and blocks
