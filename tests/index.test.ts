/// <reference types="jest" />
/// <reference types="node" />

import fs from 'node:fs';

import {
    ObjectInputStream, Serializable, Externalizable, internal,
    ObjectInputStreamAST,
    ast
} from '../src/index';
import { ClassNotFoundException, EOFException, InvalidClassException, InvalidObjectException, NotActiveException, NullPointerException, OptionalDataException, StreamCorruptedException, UTFDataFormatException, WriteAbortedException } from '../src/exceptions';
import { BaseFallbackEnum, BaseFallbackExternalizable, BaseFallbackSerializable, BaseProxy, InvocationHandler, ObjectStreamClass } from '../src/object-input-stream';

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

const CLASS_PREFIX = "com.o11k.GenerateTests$"
class EmptyClass implements Serializable {}
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

class SerParent implements Serializable {
    parentField: number
    constructor(field=-123) {
        this.parentField = field;
    }
    readObject(ois: ObjectInputStream): void {
        ois.defaultReadObject();
        this.parentField = 69;
    }
}
class SerChild extends SerParent {
    childField: number;
    constructor(pField=-123, cField=-123) {
        super(pField);
        this.childField = cField;
    }
    readObject(ois: ObjectInputStream): void {
        ois.defaultReadObject();
        this.childField = 69;
    }
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

const RESET_FILENAME = "resets";
test("resets everywhere", () => {
    const ois = new ObjectInputStream(readSerializedFile(RESET_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"EmptyClass", EmptyClass);

    expect(ois.readLong()).toBe(0x6969696969696969n);
    expect(ois.readLong()).toBe(0x6969696969696969n);
    expect(ois.readObject()).toBeInstanceOf(EmptyClass);
    expect(ois.readObject()).toBeInstanceOf(EmptyClass);
    expect(ois.readLong()).toBe(0x6969696969696969n);

    expect(() => ois.readObject()).toThrow(EOFException);
})

// test.todo("classDesc gets handle before its object")  // The docs conflict on it, so must check
// commented because docs don't really conflict

const HANDLERS_FILENAME = "handlers";
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

const CLASSES_FILENAME = "classes";
test("read classes", () => {
    const ois = new ObjectInputStream(readSerializedFile(CLASSES_FILENAME));

    // Register
    ois.registerSerializable(CLASS_PREFIX+"SerNoW", SerNoW);

    // Don't register
    //ois.registerSerializable(CLASS_PREFIX+"SerW", SerW);

    // Register random value
    const dummy_SerWExtra = Symbol("what??") as any;
    ois.registerSerializable(CLASS_PREFIX+"SerWExtra", dummy_SerWExtra);

    // Register duplicate
    ois.registerSerializable(CLASS_PREFIX+"SerWNoFields", SerNoW);

    // Register again
    ois.registerSerializable(CLASS_PREFIX+"SerWMisplacedFields", SerWMisplacedFields);

    // Externalizable: don't register
    //ois.registerExternalizable(CLASS_PREFIX+"ExtParent", ExtParent);

    // Externalizable: register
    ois.registerExternalizable(CLASS_PREFIX+"ExtChild", ExtChild);
    
    const class_SerNoW = ois.readObject();
    const class_SerW = ois.readObject();
    const class_SerWExtra = ois.readObject();
    const class_SerWNoFields = ois.readObject();
    const class_SerWMisplacedFields = ois.readObject();
    const class_ExtParent = ois.readObject();
    const class_ExtChild = ois.readObject();

    expect(class_SerNoW).toBe(SerNoW);
    expect(class_SerW.prototype).toBeInstanceOf(BaseFallbackSerializable);
    expect(class_SerWExtra).toBe(dummy_SerWExtra);
    expect(class_SerWNoFields).toBe(SerNoW);
    expect(class_SerWMisplacedFields).toBe(SerWMisplacedFields);
    expect(class_ExtParent.prototype).toBeInstanceOf(BaseFallbackExternalizable);
    expect(class_ExtChild).toBe(ExtChild);
})

const CLASSDESCS_FILENAME = "classdescs";
test("read class descriptors", () => {
    const oisPre = new ObjectInputStream(readSerializedFile(CLASSDESCS_FILENAME));
    oisPre.readEverything().forEach(item => expect(item).toBeInstanceOf(ObjectStreamClass));

    const ois = new ObjectInputStream(readSerializedFile(CLASSDESCS_FILENAME));

    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"SerNoW",
        isEnum: false, serializable: true, externalizable: false, hasWriteObjectData: false, hasBlockExternalData: false,
    });
    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"SerW",
        isEnum: false, serializable: true, externalizable: false, hasWriteObjectData: true, hasBlockExternalData: false,
    });
    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"SerWExtra",
        isEnum: false, serializable: true, externalizable: false, hasWriteObjectData: true, hasBlockExternalData: false,
    });
    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"SerWNoFields",
        isEnum: false, serializable: true, externalizable: false, hasWriteObjectData: true, hasBlockExternalData: false,
    });
    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"SerWMisplacedFields",
        isEnum: false, serializable: true, externalizable: false, hasWriteObjectData: true, hasBlockExternalData: false,
    });
    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"ExtParent",
        isEnum: false, serializable: false, externalizable: true, hasWriteObjectData: false, hasBlockExternalData: true,
    });
    expect(ois.readObject()).toMatchObject({
        name: CLASS_PREFIX+"ExtChild",
        isEnum: false, serializable: false, externalizable: true, hasWriteObjectData: false, hasBlockExternalData: true,
    });
})

const ENUMS_FILENAME = "enums";
test("enums", () => {
    const oisNoHandlers = new ObjectInputStream(readSerializedFile(ENUMS_FILENAME));
    const generatedEnum = oisNoHandlers.readObject();
    expect(generatedEnum.$desc.name).toBe(CLASS_PREFIX+"MyEnum");
    expect(generatedEnum.prototype).toBeInstanceOf(BaseFallbackEnum);
    expect(oisNoHandlers.readObject()).toMatchObject({
        name: CLASS_PREFIX+"MyEnum",
        isEnum: true, serializable: true, externalizable: false, hasWriteObjectData: false, hasBlockExternalData: false,
    });
    expect(oisNoHandlers.readObject()).toBe("MY_VALUE_1");
    expect(oisNoHandlers.readObject()).toBe("MY_VALUE_2");
    expect(oisNoHandlers.readObject()).toBe("MY_VALUE_3");
    expect(oisNoHandlers.readObject()).toBe("MY_VALUE_4");
    expect(oisNoHandlers.readObject()).toBe("MY_VALUE_5");

    const ois = new ObjectInputStream(readSerializedFile(ENUMS_FILENAME));
    const MyEnum = {
        MY_VALUE_1: "asd",
        MY_VALUE_2: 123,
        //MY_VALUE_3: ,
        MY_VALUE_4: undefined,
        MY_VALUE_5: {},
    };
    MyEnum.MY_VALUE_5 = MyEnum;
    ois.registerEnum(CLASS_PREFIX+"MyEnum", MyEnum);

    expect(ois.readObject()).toBe(MyEnum);
    expect(ois.readObject()).toMatchObject({cl: MyEnum});

    expect(ois.readObject()).toBe("asd");
    expect(ois.readObject()).toBe(123);
    expect(() => ois.readObject()).toThrow(InvalidObjectException);
    expect(ois.readObject()).toBe(undefined);
    expect(ois.readObject()).toBe(MyEnum);
})

const CONTAINERS_FILENAME = "containers";
test("container class handlers", () => {
    const preOis = new ObjectInputStream(readSerializedFile(CONTAINERS_FILENAME));

    expect(preOis.readObject()).toBeInstanceOf(Array);
    expect(preOis.readObject()).toBeInstanceOf(Array);
    expect(preOis.readObject()).toBeInstanceOf(Array);

    expect(preOis.readObject()).toBeInstanceOf(Set);
    expect(preOis.readObject()).toBeInstanceOf(Set);
    expect(preOis.readObject()).toBeInstanceOf(Set);

    expect(preOis.readObject()).toBeInstanceOf(Map);
    expect(preOis.readObject()).toBeInstanceOf(Map);
    expect(preOis.readObject()).toBeInstanceOf(Map);

    const ois = new ObjectInputStream(readSerializedFile(CONTAINERS_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"EmptyClass", EmptyClass);

    expect([...ois.readObject()]).toEqual([1.2, "asd", new EmptyClass()]);
    expect([...ois.readObject()]).toEqual(["a", "b", "c"]);
    expect([...ois.readObject()]).toEqual([1, 2, 3]);

    expect(new Set(ois.readObject())).toEqual(new Set([1.2, "asd", new EmptyClass()]));
    expect(new Set(ois.readObject())).toEqual(new Set(["a", "b", "c"]));
    expect(new Set(ois.readObject())).toEqual(new Set([1, 2, 3]));

    expect(new Map(ois.readObject())).toEqual(new Map<any, any>([[  1,   2], ["a", "b"]]));
    expect(new Map(ois.readObject())).toEqual(new Map<any, any>([[  2, "a"], [  1, "a"]]));
    expect(new Map(ois.readObject())).toEqual(new Map<any, any>([["a",   2], ["b",   2]]));
})

const PROXY_FILENAME = "proxy"
test("proxy classes", () => {
    class MyHandler implements InvocationHandler, Serializable {
        multiplier: number = 0;

        invoke(proxy: BaseProxy, method: string, args: any[]) {
                if (method === "multiply") {
                    const arg1 = args[0];
                    return arg1 * this.multiplier;
                }
                throw new TypeError();
        }
    }

    const ois = new ObjectInputStream(readSerializedFile(PROXY_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"MyHandler", MyHandler);

    const proxy = ois.readObject();
    expect(proxy).toBeInstanceOf(BaseProxy);
    if (!(proxy instanceof BaseProxy)) throw new Error();
    expect(proxy.h).toBeInstanceOf(MyHandler);
    expect(Object.getPrototypeOf(proxy).constructor.$proxyInterfaces).toEqual([
        "java.lang.Comparable",
        "java.lang.AutoCloseable",
        "java.lang.Runnable",
    ])
    expect(proxy.multiply(123)).toBe(123 * 5);
    expect(() => proxy.whatever("what", "ever")).toThrow(TypeError);
})

const EXCEPTIONS_FILENAME = "exceptions"
test("exception", () => {
    const ois = new ObjectInputStream(readSerializedFile(EXCEPTIONS_FILENAME));
    
    const empty1 = ois.readObject();

    try {
        ois.readObject();
        throw new Error("shouldn't have reached that far");
    } catch (e) {
        expect(e).toBeInstanceOf(WriteAbortedException);
    }

    const empty2 = ois.readObject();
    expect(empty1).toEqual(empty2);
    expect(empty1).not.toBe(empty2);
})

// User errors

test("readFields twice", () => {
    class BadEmptyClass implements Serializable {
        readObject(ois: ObjectInputStream): void {
            ois.readFields();
            ois.readFields();
        }
    }

    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME))
    ois.registerSerializable(CLASS_PREFIX+"EmptyClass", BadEmptyClass);

    expect(() => ois.readObject()).toThrow(NotActiveException);
})
test("readFields outside readObject", () => {
    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME));
    expect(() => ois.readFields()).toThrow(NotActiveException);
})

// test.todo("readObject where fields aren't in the start, without handler")  // Can corrupt stream
// commented because already tested in handlers

// test("externalizable without readExternal")
// commented because ts prevents that so it's beyond the scope of this test suite

test("unmatching serialVersionUID: serializable", () => {
    class UnmatchingEmptyClass implements Serializable {
        static readonly serialVersionUID = 69420n;
    }

    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME))
    ois.registerSerializable(CLASS_PREFIX+"EmptyClass", UnmatchingEmptyClass);

    expect(() => ois.readObject()).toThrow(InvalidClassException);
})

test("unmatching serialVersionUID: externalizable", () => {
    class UnmachingExtChild extends ExtChild {
        static readonly serialVersionUID = 69420n;
    }

    const ois = new ObjectInputStream(readSerializedFile(EXTERNALIZABLE_FILENAME))
    ois.registerSerializable(CLASS_PREFIX+"EmptySerW", EmptySerW);
    ois.registerExternalizable(CLASS_PREFIX+"ExtChild", UnmachingExtChild);

    expect(() => ois.readObject()).toThrow(InvalidClassException);
})

// test.todo("externalizable PROTOCOL_VERSION_1 without handler");
// commented because already tested in handlers

test("serializable reading too much", () => {
    class EmptyClassTooMuch implements Serializable {
        readObject(ois: ObjectInputStream): void {
            ois.readInt();
        }
    }

    const ois = new ObjectInputStream(readSerializedFile(OBJ_REF_FILENAME))
    ois.registerSerializable(CLASS_PREFIX+"EmptyClass", EmptyClassTooMuch);

    expect(() => ois.readObject()).toThrow(EOFException);
})
const EXTERNALIZABLE_FILENAME = "externalizable"
test("readFields inside readExternal", () => {
    class ExtChildReadFields implements Externalizable {
        i_in_js: number; constructor(i=0) {this.i_in_js = i;}
        readExternal(ois: ObjectInputStream) {
            ois.readFields();
        }
    }
    const ois = new ObjectInputStream(readSerializedFile(EXTERNALIZABLE_FILENAME))
    ois.registerExternalizable(CLASS_PREFIX+"ExtChild", ExtChildReadFields);
    expect(() => ois.readObject()).toThrow(NotActiveException);
})
test("externalizable reading too much STREAM_VERSION_2,1", () => {
    class ExtChildTooMuch implements Externalizable {
        i_in_js: number; constructor(i=0) {this.i_in_js = i;}
        readExternal(ois: ObjectInputStream) {
            this.i_in_js = ois.readInt();
            expect(ois.readUTF()).toBe("testicle");
            expect(ois.readObject()).toBeInstanceOf(EmptySerW);
            ois.readObject();
        }
    }
    const ois = new ObjectInputStream(readSerializedFile(EXTERNALIZABLE_FILENAME))
    ois.registerExternalizable(CLASS_PREFIX+"ExtChild", ExtChildTooMuch);
    ois.registerSerializable(CLASS_PREFIX+"EmptySerW", EmptySerW);
    // STREAM_VERSION_2
    expect(() => ois.readObject()).toThrow(new OptionalDataException(true));
    // STREAM_VERSION_1
    expect(() => ois.readObject()).toThrow(StreamCorruptedException);
})
test("read too much", () => {
    const oisPrimitive = new ObjectInputStream(readSerializedFile(PRIMITIVES_FILENAME));
    oisPrimitive.readEverything();
    expect(() => oisPrimitive.readByte()).toThrow(EOFException);
    expect(() => oisPrimitive.readObject()).toThrow(EOFException);

    const oisObject = new ObjectInputStream(readSerializedFile(PRIMITIVE_WRAPPERS_FILENAME));
    oisObject.readEverything();
    expect(() => oisPrimitive.readByte()).toThrow(EOFException);
    expect(() => oisPrimitive.readObject()).toThrow(EOFException);
})
test("readObject when in block", () => {
    const ois = new ObjectInputStream(readSerializedFile(PRIMITIVES_FILENAME));
    expect(() => ois.readObject()).toThrow(OptionalDataException);
    ois.readInt();
    expect(() => ois.readObject()).toThrow(OptionalDataException);
})
test("read[primitive] when not in block", () => {
    const ois = new ObjectInputStream(readSerializedFile(PRIMITIVE_WRAPPERS_FILENAME));
    expect(() => ois.readByte()).toThrow(EOFException);
    ois.readObject();
    expect(() => ois.readByte()).toThrow(EOFException);
})

const SERIALIZABLE_EXTENDS_FILENAME = "ser-extends";
test("serializable parent and child: both registered", () => {
    const ois = new ObjectInputStream(readSerializedFile(SERIALIZABLE_EXTENDS_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"SerParent", SerParent);
    ois.registerSerializable(CLASS_PREFIX+"SerChild", SerChild);
    expect(ois.readObject()).toEqual(new SerChild(69, 69));
})
test("serializable parent and child: child registered", () => {
    const ois = new ObjectInputStream(readSerializedFile(SERIALIZABLE_EXTENDS_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"SerChild", SerChild);
    expect(ois.readObject()).toEqual(new SerChild(5, 69));
})
test("serializable parent and child: parent registered", () => {
    const ois = new ObjectInputStream(readSerializedFile(SERIALIZABLE_EXTENDS_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"SerParent", SerParent);
    const obj = ois.readObject();
    expect(obj).toMatchObject({parentField: 69, childField: 5});
    expect(obj).toBeInstanceOf(SerParent);
})
test("serializable parent and child: both unregistered", () => {
    const ois = new ObjectInputStream(readSerializedFile(SERIALIZABLE_EXTENDS_FILENAME));
    expect(ois.readObject()).toMatchObject({parentField: 5, childField: 5});
})
test("serializable parent class in java but not js", () => {
    class OtherSerParent implements Serializable {}
    const ois = new ObjectInputStream(readSerializedFile(SERIALIZABLE_EXTENDS_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"SerParent", OtherSerParent);
    ois.registerSerializable(CLASS_PREFIX+"SerChild", SerChild);
    expect(() => ois.readObject()).toThrow(ClassNotFoundException);
})

// These tests test very subtle object replacement behavior
const RESOLVE_FILENAME = "resolve";
// 1. obj_a begins reading
// 2. obj_b is read. it has obj_a as a field
// 3. obj_a finishes reading and is replaced by something else
// 4. make sure obj_b's field is the original obj_a and not the replacement
test("readResolve circular reference", () => {
    class SerWithChildObjA implements Serializable {
        child: any
        readResolve() {
            return 5;
        }
    }
    class SerWithChildObjB implements Serializable {
        child: any;
    }
    const ois = new ObjectInputStream(readSerializedFile(RESOLVE_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"SerWithChildObjA", SerWithChildObjA);
    ois.registerSerializable(CLASS_PREFIX+"SerWithChildObjB", SerWithChildObjB);

    const obj_a = ois.readObject();
    const obj_b = ois.readObject();

    expect(obj_a).toBe(5);
    expect(obj_b.child).toBeInstanceOf(SerWithChildObjA);
})
// 1. obj_a begins reading
// 2. obj_b is read and reaplced by obj_a. now obj_a has 2 handles
// 3. obj_a finishes reading and is replaced by something else
// 4. obj_b is read again from the stream. make sure it is the original obj_a and not the replacement
test("readResolve multiple handles", () => {
    class SerWithChildObjA implements Serializable {
        child: any
        readResolve() {
            return 5;
        }
    }
    class SerWithChildObjB implements Serializable {
        child: any;
        readResolve() {
            return this.child;
        }
    }
    const ois = new ObjectInputStream(readSerializedFile(RESOLVE_FILENAME));
    ois.registerSerializable(CLASS_PREFIX+"SerWithChildObjA", SerWithChildObjA);
    ois.registerSerializable(CLASS_PREFIX+"SerWithChildObjB", SerWithChildObjB);

    const obj_a = ois.readObject();
    const obj_b = ois.readObject();

    expect(obj_a).toBe(5);
    expect(obj_b).toBeInstanceOf(SerWithChildObjA);
})

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

test("eof in middle of block", () => {
    const ois = new ObjectInputStream(new Uint8Array([
        0xac, 0xed, 0x00, 0x05,    // Header
        c.TC_BLOCKDATA, 0xff,
        0x69, 0x69, 0x69,
    ]));
    expect(() => ois.read1()).toThrow(StreamCorruptedException);
})


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
